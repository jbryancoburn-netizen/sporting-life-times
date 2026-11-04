#!/usr/bin/env python3
"""Sporting Life & Times national college-basketball news desk. Free RSS + existing school feeds."""
import json, pathlib, re, hashlib, xml.etree.ElementTree as ET
from urllib.request import Request, urlopen
from urllib.parse import quote
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from concurrent.futures import ThreadPoolExecutor

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"data/cbb-national-news.json"
NOW=datetime.now(timezone.utc)
QUERIES=[
 ("men","college basketball men's NCAA when:3d"),
 ("women","women's college basketball NCAA when:3d"),
 ("men","NCAA men's basketball rankings conference upset when:3d"),
 ("women","NCAA women's basketball rankings conference upset when:3d"),
 ("men","college basketball recruiting commitment transfer portal when:5d"),
 ("women","women's college basketball recruiting transfer portal when:5d"),
 ("men","college basketball coaching injury when:5d"),
 ("women","women's college basketball coaching injury when:5d"),
]
STOP=re.compile(r"\b(college football|NFL|NBA|WNBA|MLB|NHL|soccer|baseball|hockey|sportsbook|promo code|bonus bets)\b",re.I)
LOW=re.compile(r"\b(odds|spread|betting|wager|parlay|picks|prediction|where to watch|streaming|tv channel|highlights|top [0-9]+ plays)\b",re.I)
KEY=re.compile(r"\b(transfer|commit|recruit|injur|coach|rank|poll|upset|champion|tournament|win|loss|beat|defeat|conference|NCAA|final four|basketball)\b",re.I)
def rss(item):
 gender,query=item
 address="https://news.google.com/rss/search?q="+quote(query)+"&hl=en-US&gl=US&ceid=US:en"
 req=Request(address,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)"})
 try:
  with urlopen(req,timeout=16) as f: doc=ET.fromstring(f.read())
 except Exception as e:
  print("Feed unavailable",gender,str(e)[:100]);return []
 result=[]
 for entry in doc.findall("./channel/item"):
  title=(entry.findtext("title") or "").strip()
  url=(entry.findtext("link") or "").strip()
  source=(entry.findtext("source") or "Google News").strip()
  try: when=parsedate_to_datetime(entry.findtext("pubDate")).astimezone(timezone.utc)
  except (TypeError,ValueError,AttributeError):continue
  if not title or not url or STOP.search(title) or LOW.search(title) or when>NOW+timedelta(hours=1) or NOW-when>timedelta(days=6):continue
  title=re.sub(r"\s+-\s+"+re.escape(source)+r"$","",title,flags=re.I).strip()
  result.append({"title":title,"url":url,"source":source,"published_at":when.isoformat(),"summary":"","gender":gender,"category":"CBB","origin":"national RSS"})
 return result
def prior_school():
 folder=ROOT/"data/mbb-team-news"
 result=[]
 for file in folder.glob("*.json"):
  if not file.stem.isdigit():continue
  try: data=json.loads(file.read_text())
  except (OSError,ValueError):continue
  for a in data.get("articles",[])[:7]:
   try: dt=datetime.fromisoformat(a["published_at"].replace("Z","+00:00"))
   except (ValueError,KeyError,TypeError):continue
   if NOW-dt>timedelta(days=5) or dt>NOW+timedelta(hours=1) or LOW.search(a.get("title","")) or STOP.search(a.get("title","")):continue
   result.append({**a,"gender":"men","category":"CBB","origin":"school","school":data.get("team"),"team_id":data.get("team_id")})
 return result
with ThreadPoolExecutor(max_workers=4) as pool:
 fresh=[a for batch in pool.map(rss,QUERIES) for a in batch]
fresh.extend(prior_school())
if OUT.exists():
 try: old=json.loads(OUT.read_text()).get("articles",[])
 except ValueError: old=[]
 for a in old:
  try: age=NOW-datetime.fromisoformat(a["published_at"].replace("Z","+00:00"))
  except (ValueError,KeyError,TypeError):continue
  if age<timedelta(days=5):fresh.append(a)
unique={}
for a in fresh:
 key=re.sub(r"[^a-z0-9]","",a.get("title","").casefold())[:130]
 if not key or not a.get("url"):continue
 if key not in unique or a.get("origin")=="national RSS":unique[key]=a
def priority(a):
 title=a.get("title",""); published=datetime.fromisoformat(a["published_at"].replace("Z","+00:00"))
 hours=max(0,(NOW-published).total_seconds()/3600)
 impact=60 if KEY.search(title) else 0
 specificity=12 if a.get("origin")=="national RSS" else 3
 return impact+specificity+max(0,48-hours)
men=sorted((a for a in unique.values() if a.get("gender")=="men"),key=priority,reverse=True)[:100]
women=sorted((a for a in unique.values() if a.get("gender")=="women"),key=priority,reverse=True)[:100]
if not men and not women:
 print("No valid reporting; existing published edition preserved");raise SystemExit(0)
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps({"edition":"Sporting Life & Times","season":"2026-27","updated_at":NOW.isoformat(),"sources":["Google News RSS","existing school reporting"],"coverage":{"men":len(men),"women":len(women)},"articles":men+women},indent=2,ensure_ascii=False)+"\n")
print("National basketball reporting:",len(men),"men",len(women),"women")

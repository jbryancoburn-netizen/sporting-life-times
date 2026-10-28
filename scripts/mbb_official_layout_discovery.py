#!/usr/bin/env python3
"""Official athletics alternate-layout discovery. No inferred game-site writes.
Parses Sidearm schedule cards and JSON-LD, requiring a unique opponent+date match.
"""
import json,re,pathlib,collections,datetime,os
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1]/"data"
cross=json.loads((root/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
start=int(os.getenv("START","0"));end=int(os.getenv("END","100"))
teams=cross[start:end]
session=requests.Session();session.headers["User-Agent"]="Mozilla/5.0"
def clean(s):return re.sub(r"[^a-z0-9]","",str(s or "").lower())
def date(s):
 s=str(s or "")
 m=re.search(r"202[67]-\d\d-\d\d",s)
 if m:return m.group()
 for fmt in ("%b %d, %Y","%B %d, %Y","%a, %b %d, %Y","%A, %B %d, %Y"):
  try:return datetime.datetime.strptime(s[:38].strip(),fmt).strftime("%Y-%m-%d")
  except ValueError:pass
 return ""
def side(s):
 t=re.sub(r"\s+"," ",str(s or "").strip().lower())
 if re.search(r"\b(neutral|neutral site)\b",t):return "neutral"
 if re.search(r"\b(away|at|@)\b",t) and len(t)<35:return "away"
 if re.search(r"\b(home|vs|vs\.)\b",t) and len(t)<35:return "home"
 return ""
def extract(html):
 soup=BeautifulSoup(html,"html.parser");found=[];seen=set()
 # Sidearm game cards commonly use one of these selectors, unlike <table> pages.
 selectors=[".sidearm-schedule-game",".sidearm-schedule-game-row",
  "[class*='schedule-game']","[class*='schedule_game']",
  "[data-game-id]","[data-event-id]"]
 for el in soup.select(",".join(selectors)):
  dt=el.get("data-date") or el.get("datetime") or ""
  if not dt:
   node=el.select_one("time[datetime],[class*='date'],[data-date]")
   if node:dt=node.get("datetime") or node.get("data-date") or node.get_text(" ",strip=True)
  day=date(dt)
  if not day:continue
  op=el.select_one("[class*='opponent-name'],[class*='opponent_name'],[class*='opponent-title'],[class*='opponent_title']")
  if not op:continue
  opponent=op.get_text(" ",strip=True)
  label=el.select_one("[class*='home-away'],[class*='home_away'],[class*='location-type'],[class*='location_type']")
  raw=(label.get_text(" ",strip=True) if label else "")
  if not raw:
   for a in ("data-home-away","data-site","data-game-location"):
    if el.get(a):raw=el[a];break
  place=el.select_one("[class*='venue'],[class*='location']")
  location=place.get_text(" ",strip=True) if place else ""
  flag=side(raw)
  if not flag:continue
  key=(day,clean(opponent),flag)
  if key not in seen:found.append(dict(date=day,opponent=opponent,site=flag,location=location,method="official_schedule_card"));seen.add(key)
 # Structured events can confirm the opponent and location; home/away only when explicit.
 for script in soup.select('script[type="application/ld+json"]'):
  try:obj=json.loads(script.string or script.get_text())
  except (ValueError,TypeError):continue
  stack=obj if isinstance(obj,list) else [obj]
  while stack:
   x=stack.pop()
   if isinstance(x,list):stack.extend(x);continue
   if not isinstance(x,dict):continue
   if "@graph" in x:stack.append(x["@graph"])
   typ=x.get("@type",[])
   if isinstance(typ,str):typ=[typ]
   if not any("SportsEvent" in z for z in typ):continue
   day=date(x.get("startDate"));home=x.get("homeTeam");away=x.get("awayTeam")
   if not (day and home and away):continue
   def name(y):return y.get("name","") if isinstance(y,dict) else str(y)
   found.append(dict(date=day,home=name(home),away=name(away),method="official_jsonld"))
 return found
audit=[];stats=collections.Counter()
for t in teams:
 tid=str(t.get("espn_id") or "");p=root/"mbb-schedules-2026-27"/(tid+".json")
 if not p.exists():continue
 d=json.loads(p.read_text());url=d.get("source_url","")
 rec=dict(id=tid,school=t.get("name"),status="unresolved",rows=0,candidates=[])
 if not url.startswith("https://"):rec["status"]="no_official_url";audit.append(rec);continue
 parsed=urlparse(url)
 if any(z in parsed.netloc for z in ("espn.com","realgm.com","wikipedia.org")):rec["status"]="untrusted_source";audit.append(rec);continue
 urls=list(dict.fromkeys([url.replace("/schedule/text/","/schedule/"),url]))
 matches=[]
 for page in urls[:2]:
  try:
   response=session.get(page,timeout=8)
   if not response.ok or urlparse(response.url).hostname!=parsed.hostname:continue
   matches.extend(extract(response.text));rec["candidates"].append(dict(url=response.url,extracted=len(matches)))
  except requests.RequestException:continue
 rec["rows"]=len(matches);stats["official_rows_extracted"]+=len(matches)
 if matches:rec["status"]="extracted_official_cards";stats["schools_with_cards"]+=1
 else:rec["status"]="no_supported_card_layout"
 # Audit only. Never overwrite home/away without exact date+opponent and identity.
 audit.append(rec);stats[rec["status"]]+=1
out={"schools_requested":len(teams),"schools_checked":len(audit),"summary":dict(stats),"results":audit,
 "policy":"Discovery-only: no schedule mutation; actual layout and safe-match validation required before promotion"}
suffix=os.getenv("BATCH","first-100")
(root/("mbb-official-layout-"+suffix+".json")).write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps({"checked":len(audit),"summary":dict(stats)},indent=2))

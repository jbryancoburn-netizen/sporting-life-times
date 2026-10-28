#!/usr/bin/env python3
"""Verify D-I game sites from official university schedule page CARD TEXT.
Refuse ambiguous dates/opponents and preserve existing verified records.
"""
import json, pathlib, re, os, collections, concurrent.futures, urllib.parse
from datetime import datetime
import requests
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1]/"data"
teams=json.loads((root/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
def norm(v):
 s=str(v or "").lower();s=re.sub(r"\\b(university|college|state|the|of|at)\\b"," ",s)
 return re.sub(r"[^a-z0-9]","",s)
def parse_date(x):
 t=str(x or "")
 m=re.search(r"202[67]-\\d{2}-\\d{2}",t)
 if m:return m.group()
 m=re.search(r"\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+(\\d{1,2})\\b",t,re.I)
 if not m:return None
 months="jan feb mar apr may jun jul aug sep oct nov dec".split()
 month=months.index(m[1][:3].lower())+1
 return f"{2026 if month>6 else 2027}-{month:02d}-{int(m[2]):02d}"
def parse(page):
 soup=BeautifulSoup(page,"html.parser");out=[]
 for card in soup.select(".sidearm-schedule-game,.sidearm-schedule-game-row,[class*='schedule-game'],[class*='schedule_game'],[data-game-id]"):
  dt=card.get("data-date") or card.get("datetime") or ""
  node=card.select_one("time,[class*='date']")
  if not dt and node:dt=node.get("datetime") or node.get_text(" ",strip=True)
  day=parse_date(dt)
  if not day:continue
  op=card.select_one("[class*='opponent-name'],[class*='opponent_name'],[class*='opponent-title'],[class*='opponent_title']")
  if not op:continue
  name=op.get_text(" ",strip=True)
  # Explicit proximity markers only, never deduce from home arena or town.
  place=card.select_one("[class*='home-away'],[class*='home_away'],[class*='location-type'],[class*='location_type']")
  tag=(place.get_text(" ",strip=True) if place else card.get("data-home-away") or "").strip().lower()
  site={"home":"home","away":"away","neutral":"neutral","vs":"home","vs.":"home","at":"away","@":"away"}.get(tag)
  if not site:
   # University cards often render 'at' or 'vs' in an immediate sibling to the opponent.
   parent=op.parent
   prefix=parent.get_text(" ",strip=True) if parent else ""
   if re.match(r"^at\\s",prefix,re.I):site="away"
   elif re.match(r"^vs\\.?\\s",prefix,re.I):site="home"
  if site:out.append({"day":day,"opponent":name,"site":site})
 return out
def school(t):
 id=str(t.get("espn_id") or "");path=root/"mbb-schedules-2026-27"/(id+".json")
 result={"id":id,"school":t["name"],"status":"unresolved","corrections":0,"cards":0}
 if not path.exists():result["status"]="missing_file";return result
 data=json.loads(path.read_text());url=data.get("source_url","")
 if not url.startswith("https://"):result["status"]="missing_official_url";return result
 host=urllib.parse.urlparse(url).hostname
 if any(h in str(host) for h in ("espn.com","realgm.com","wikipedia.org")):result["status"]="nonofficial_source";return result
 candidates=list(dict.fromkeys([url.replace("/schedule/text/","/schedule/"),url]))
 cards=[]
 for candidate in candidates:
  try:
   resp=requests.get(candidate,timeout=7,headers={"User-Agent":"Mozilla/5.0"})
   if resp.ok and urllib.parse.urlparse(resp.url).hostname==host:
    cards=parse(resp.text)
    if cards:break
  except requests.RequestException:continue
 result["cards"]=len(cards)
 if not cards:result["status"]="no_explicit_cards";return result
 for event in data.get("events",[]):
  if event.get("site_verified") is True:continue
  day=str(event.get("date",""))[:10]
  comps=(event.get("competitions") or [{}])[0].get("competitors") or []
  me=next((x for x in comps if str((x.get("team") or {}).get("id"))==id),None)
  other=next((x for x in comps if x is not me),None)
  if not me or not other:continue
  target=norm((other.get("team") or {}).get("displayName"))
  if len(target)<4:continue
  matching=[x for x in cards if x["day"]==day and len(norm(x["opponent"]))>=4 and (norm(x["opponent"]) in target or target in norm(x["opponent"]))]
  if len(matching)!=1:continue
  val=matching[0]["site"]
  me["homeAway"]=val;other["homeAway"]={"home":"away","away":"home","neutral":"neutral"}[val]
  event["neutralSite"]=val=="neutral";event["site_verified"]=True
  event["site_source_url"]=resp.url;event["site_verified_via"]="official_schedule_card_date_opponent"
  result["corrections"]+=1
 if result["corrections"]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\\n")
 result["status"]="corrected" if result["corrections"] else "no_new_unique_matches"
 return result
start=int(os.getenv("START","0"));end=int(os.getenv("END","365"))
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:results=list(ex.map(school,teams[start:end]))
stat=collections.Counter(x["status"] for x in results)
out={"requested":end-start,"total_corrected":sum(x["corrections"] for x in results),"status":dict(stat),"schools":results}
(root/("mbb-official-card-apply-"+os.getenv("BATCH","365")+".json")).write_text(json.dumps(out,indent=2)+"\\n")
print(json.dumps({k:v for k,v in out.items() if k!="schools"},indent=2))

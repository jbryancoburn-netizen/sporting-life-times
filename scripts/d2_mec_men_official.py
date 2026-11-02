#!/usr/bin/env python3
"""MEC 2026–27 men's fixtures: require TWO exact official university grid claims.

University calendars are NOT score sources. Unmatched dates, neutral opponents,
missing school identity and conflicting home-away remain quarantined. Retain
NCAA canonical IDs, finals, independent Elo, and existing media metadata.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup

# Official, free, independently posted SIDEARM university athletic schedules;
# school/year/gender title and >=16 identifiable league games are required.
SOURCES={
 "charleston":"https://ucgoldeneagles.com/sports/mens-basketball/schedule/2026-2027?grid=true",
 "concord":"https://cumountainlions.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "davis-elkins":"https://senatornation.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "fairmont-state":"https://fightingfalcons.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "frostburg-state":"https://frostburgsports.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "glenville-state":"https://gstatepioneers.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "point-park":"https://pointparksports.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "shawnee-state":"https://ssubears.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "west-liberty":"https://hilltoppersports.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "west-virginia-state":"https://wvsuyellowjackets.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "west-virginia-wesleyan":"https://wesleyanbobcats.com/sports/mens-basketball/schedule/2026-27?grid=true",
 "wheeling":"https://wucardinals.com/sports/mens-basketball/schedule/2026-2027?grid=true",
}
ALIASES={
 "charleston":("Charleston","University of Charleston"),
 "concord":("Concord","Concord University"),
 "davis-elkins":("Davis & Elkins","Davis and Elkins","Davis & Elkins College"),
 "fairmont-state":("Fairmont State","Fairmont State University"),
 "frostburg-state":("Frostburg State","Frostburg State University"),
 "glenville-state":("Glenville State","Glenville State University","Glenville State College"),
 "point-park":("Point Park","Point Park (Pa.)","Point Park University (Pa.)","Point Park University"),
 "shawnee-state":("Shawnee State","Shawnee State (Ohio)","Shawnee State University","Shawnee State University (Ohio)"),
 "west-liberty":("West Liberty","West Liberty University"),
 "west-virginia-state":("West Virginia State","West Virginia State University"),
 "west-virginia-wesleyan":("West Virginia Wesleyan","West Virginia Wesleyan College"),
 "wheeling":("Wheeling","Wheeling University")
}
def norm(v):return " ".join(re.sub(r"[^a-z0-9]+"," ",str(v or "").lower().replace("&"," and ")).split())
LOOKUP={}
for key,names in ALIASES.items():
 for label in (*names,key):
  k=norm(label)
  if k in LOOKUP and LOOKUP[k]!=key:raise ValueError("MEC institutional identity alias collision: "+label)
  LOOKUP[k]=key
def school(v):return LOOKUP.get(norm(v))
def fetch(url):
 request=urllib.request.Request(url,headers={"User-Agent":
  "SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
  "Accept":"text/html"})
 with urllib.request.urlopen(request,timeout=18) as response:
  return response.read(1750000).decode("utf-8","replace")
def local_et(value):
 s=" ".join(str(value or "").upper().replace(".","").split())
 m=re.fullmatch(r"([1-9]|1[0-2])(?::([0-5][0-9]))?\s*([AP])M",s)
 return f"{m[1]}:{m[2] or '00'} {m[3]}M ET" if m else None
def parse(html,owner,url):
 if owner not in SOURCES or url!=SOURCES[owner]:raise ValueError("Unknown MEC owner/URL")
 soup=BeautifulSoup(html,"html.parser")
 title=soup.title.get_text(" ",strip=True) if soup.title else ""
 full=soup.get_text(" ",strip=True)
 if not re.search(r"2026\s*[-–]\s*(?:2027|27)\s+Men['’]s Basketball",title,re.I):
  raise ValueError("Incorrect gender or season for MEC "+owner+": "+title[:90])
 if not any(norm(name) in norm(title+" "+full[:1300]) for name in ALIASES[owner] if len(norm(name))>8):
  raise ValueError("MEC school identity missing in official page header: "+owner)
 selected=[]
 for table in soup.select("table"):
  for hr in table.select("tr"):
   headings=[norm(x.get_text(" ",strip=True)) for x in hr.find_all("th",recursive=False)]
   required=("date","time","at","opponent","location")
   if not all(col in headings for col in required):continue
   pos={col:headings.index(col) for col in required}
   rows=[]
   for tr in table.select("tr"):
    cols=[x.get_text(" ",strip=True) for x in tr.find_all("td",recursive=False)]
    if len(cols)<=max(pos.values()):continue
    m=re.search(r"([A-Za-z]+ \d{1,2}, 202[67])",cols[pos["date"]])
    if not m:continue
    try:date=dt.datetime.strptime(m[1],"%B %d, %Y").date().isoformat()
    except ValueError:continue
    if not "2026-11-01"<=date<="2027-02-28":continue
    role=norm(cols[pos["at"]])
    if role not in ("home","away"):continue
    other=school(cols[pos["opponent"]])
    if not other or other==owner:continue
    away,home=(other,owner) if role=="home" else (owner,other)
    place=cols[pos["location"]];venue=None
    if role=="home" and "/" in place:
     city,arena=place.split("/",1)
     if re.search(r"\b(gym(?:nasium)?|arena|center|complex|fieldhouse)\b",arena,re.I):
      venue=arena.strip()+" · "+city.strip()
    rows.append({"date":date,"away":away,"home":home,"owner":owner,
                 "tipoff":local_et(cols[pos["time"]]),"venue":venue,"url":url})
   if len(rows)>len(selected):selected=rows
   break
 if len(selected)<16:raise ValueError(f"MEC {owner} insufficient conference school fixtures: {len(selected)}")
 if len({(r["date"],r["away"],r["home"]) for r in selected})!=len(selected):
  raise ValueError("Duplicate MEC school fixture "+owner)
 return selected
def team_index(teams):
 result={};duplicate=set()
 for ident,t in teams.items():
  if t.get("not_eligible_for_dii_elo") or t.get("conference") not in ("MEC","Mountain East Conference"):continue
  key=school(t.get("name")) or school(ident.replace("-"," "))
  if key:
   if key in result and result[key]!=ident:duplicate.add(key)
   else:result[key]=ident
 for k in duplicate:result.pop(k,None)
 return result,sorted(duplicate)
def enrich_mec_men(games,teams,today=None,fetcher=fetch):
 today=today or dt.date.today()
 members,ambiguous=team_index(teams)
 if len(members)<10 or ambiguous:
  return {"status":"MEC roster incomplete; withheld","members":len(members),
          "ambiguous":ambiguous,"added":0,"enriched":0}
 records={};unavailable=[]
 with ThreadPoolExecutor(max_workers=8) as pool:
  jobs={pool.submit(fetcher,url):owner for owner,url in SOURCES.items()}
  for future in as_completed(jobs):
   owner=jobs[future]
   try:records[owner]=parse(future.result(),owner,SOURCES[owner])
   except Exception as exc:unavailable.append({"owner":owner,"reason":str(exc)[:150]})
 if len(records)<6:
  return {"status":"MEC fewer than six university calendars; withheld",
          "read":len(records),"unavailable":unavailable,"added":0,"enriched":0}
 claims=defaultdict(dict)
 for owner,rows in records.items():
  for row in rows:
   k=(row["date"],row["away"],row["home"])
   claims[k][owner]=None if owner in claims[k] else row
 old=defaultdict(list)
 for game in games.values():
  if game.get("date") and game.get("away") and game.get("home"):
   old[(game["date"],frozenset((game["away"],game["home"])))].append(game)
 added=enriched=reciprocal=one_sided=conflicts=time_conflicts=tipoffs=arenas=0
 for (date,away,home),witnesses in sorted(claims.items()):
  if set(witnesses)!={away,home} or None in witnesses.values():
   one_sided+=1;continue
  if away not in members or home not in members:conflicts+=1;continue
  a,h=members[away],members[home];existing=old.get((date,frozenset((a,h))),[])
  if len(existing)>1 or (existing and (existing[0].get("away")!=a or
         existing[0].get("home")!=h or existing[0].get("neutral"))):
   conflicts+=1;continue
  reciprocal+=1
  source_urls=sorted(v["url"] for v in witnesses.values())
  if existing:
   game=existing[0];current=set(game.get("official_schedule_sources") or [])
   if set(source_urls)-current:
    game["official_schedule_sources"]=sorted(current.union(source_urls));enriched+=1
  elif date>=today.isoformat():
   gid=f"d2mec-men-2026-{date}-{away}-{home}"
   if gid in games:conflicts+=1;continue
   game={"id":gid,"date":date,"away":a,"home":h,"status":"scheduled",
         "away_score":None,"home_score":None,"verified":True,
         "elo_eligible":True,"neutral":False,"conference_game":True,
         "source":"MEC 2026-27 reciprocal official university calendars",
         "source_url":source_urls[0],"official_schedule_sources":source_urls}
   games[gid]=game;old[(date,frozenset((a,h)))].append(game);added+=1
  else:continue
  clock={v["tipoff"] for v in witnesses.values() if v["tipoff"]}
  if len(clock)>1:time_conflicts+=1
  elif len(clock)==1 and not game.get("start_time"):
   game["start_time"]=next(iter(clock));game["tipoff_source_url"]=source_urls[0];tipoffs+=1
  host=witnesses.get(home)
  if host and host["venue"] and not game.get("venue"):
   game["venue"]=host["venue"];game["venue_source_url"]=host["url"];arenas+=1
 return {"status":"MEC 2026-27 exact two-university men's fixtures verified",
         "gender":"men","schools_read":len(records),"added":added,"enriched":enriched,
         "reciprocal":reciprocal,"one_sided":one_sided,"conflicts":conflicts,
         "time_conflicts":time_conflicts,"official_tipoffs_added":tipoffs,
         "official_arenas_added":arenas,"unavailable":unavailable,
         "source":"Mountain East universities' own official 2026-27 basketball calendars"}

#!/usr/bin/env python3
"""Northeast-10 2026-27 DII basketball schedules from official member calendars.

Twenty source IDs are individually verified (ten per gender). Conference
games require BOTH schools' exact 2026-27 date + H/A confirmation. Uncertain
time, non-conference and neutral/ambiguous matches remain unpublished.
NE10 campuses are all Eastern; times are attributed ET only when both
school calendars independently publish the same precise tipoff.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup

BASE="https://northeast10.org/schedule.aspx?schedule="
SCHOOLS={
 "adelphi":("Adelphi","Adelphi University"),
 "aic":("American International","American International College","AIC"),
 "assumption":("Assumption","Assumption University"),
 "bentley":("Bentley","Bentley University"),
 "franklin":("Franklin Pierce","Franklin Pierce University"),
 "pace":("Pace","Pace University"),
 "anselm":("Saint Anselm","Saint Anselm College","St. Anselm","St. Anselm College"),
 "michael":("Saint Michael's","Saint Michael's College",
            "St. Michael's College","St. Michael's"),
 "sconn":("Southern Connecticut","Southern Connecticut State",
          "Southern Connecticut State University","SCSU"),
 "snhu":("Southern New Hampshire","Southern New Hampshire University","SNHU"),
}
SOURCES={
 "men":dict(zip(range(4100,4110),("adelphi","aic","assumption","bentley",
 "pace","anselm","michael","snhu","franklin","sconn"))),
 "women":dict(zip(range(4110,4120),("adelphi","aic","assumption","bentley",
 "franklin","pace","anselm","michael","snhu","sconn"))),
}
def norm(s):return " ".join(re.sub(r"[^a-z0-9 ]"," ",str(s or "").lower()).split())
ALIASES={norm(alias):key for key,labels in SCHOOLS.items() for alias in labels}
assert len(SOURCES["men"])==len(SOURCES["women"])==10
assert not set(SOURCES["men"]) & set(SOURCES["women"])
assert len(ALIASES)==sum(len(labels) for labels in SCHOOLS.values())
def school(raw):return ALIASES.get(norm(raw))
def fetch(url):
 req=urllib.request.Request(url,headers={
   "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
   "Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=18) as response:
  return response.read(1_700_000).decode("utf-8","replace")
def time_et(raw):
 m=re.fullmatch(r"\s*(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?\s*",str(raw or ""),re.I)
 return f"{int(m[1])}:{m[2]} {m[3].upper()}M ET" if m else None
def parse(html,gender,sid):
 if sid not in SOURCES.get(gender,{}):raise ValueError("Unrecognized NE10 calendar ID or gender")
 soup=BeautifulSoup(html,"html.parser")
 title=" ".join(([soup.title.get_text(" ",strip=True) if soup.title else ""]+
                 [h.get_text(" ",strip=True) for h in soup.find_all(["h1","h2"],limit=3)]))
 title=title.replace("’","'")
 hit=re.search(r"2026-27\s+(.+?)\s+(Men's|Women's)\s+Basketball",title,re.I)
 if not hit:raise ValueError("Wrong NE10 source season/sport")
 seen_gender="women" if hit[2].lower().startswith("women") else "men"
 owner=school(hit[1])
 if seen_gender!=gender or owner!=SOURCES[gender][sid]:
  raise ValueError("NE10 source gender or school title mismatch")
 parsed=[];bad=0;found=False
 for table in soup.select("table"):
  headings=norm(" ".join(th.get_text(" ",strip=True) for th in table.select("th")))
  if not all(v in headings for v in ("date","time","opponent","location","conference")):continue
  found=True
  for tr in table.select("tr"):
   cols=[" ".join(td.get_text(" ",strip=True).split())
         for td in tr.find_all(["td","th"],recursive=False)]
   if len(cols)<6 or "*" not in cols[5]:continue
   raw,clock,opponent,location,score,conference=cols[:6]
   if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw):
    bad+=1;continue
   try:when=dt.datetime.strptime(raw,"%m/%d/%Y").date()
   except ValueError:bad+=1;continue
   if not dt.date(2026,11,1)<=when<=dt.date(2027,3,1):continue
   if re.match(r"^(?:vs\.?|versus)\s+",opponent,re.I):bad+=1;continue
   at=bool(re.match(r"^at\s+",opponent,re.I))
   opponent_id=school(re.sub(r"^at\s+","",opponent,flags=re.I))
   if not opponent_id or opponent_id==owner:
    bad+=1;continue
   away,home=(owner,opponent_id) if at else (opponent_id,owner)
   parsed.append((when.isoformat(),away,home,owner,time_et(clock)))
  break
 if not found or len(parsed)<7:
  raise ValueError(f"NE10 official source lacks 2026-27 conference slate: {sid}")
 return parsed,bad
def identities(teams):
 found={};conflicts=set()
 for ident,t in teams.items():
  if t.get("conference") not in ("NE-10","Northeast 10 Conference"):continue
  key=school(t.get("name")) or school(str(ident).replace("-"," "))
  if not key:continue
  if key in found and found[key]!=ident:conflicts.add(key)
  else:found[key]=ident
 for key in conflicts:found.pop(key,None)
 return found,conflicts
def enrich_ne10(gender,games,teams,today=None,fetcher=fetch):
 if gender not in SOURCES:raise ValueError("Wrong gender")
 today=today or dt.date.today()
 ids,identity_conflicts=identities(teams)
 if len(ids)!=10 or identity_conflicts:
  return {"status":"NE10 member names unresolved; fixtures held",
          "teams_identified":len(ids),"ambiguous":sorted(identity_conflicts),
          "added":0,"enriched":0}
 calendars={};unavailable=[];rejected=0
 with ThreadPoolExecutor(max_workers=8) as pool:
  jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
  for future in as_completed(jobs):
   sid=jobs[future]
   try:
    rows,bad=parse(future.result(),gender,sid)
    calendars[sid]=rows;rejected+=bad
   except Exception as e:
    unavailable.append({"id":sid,"school":SOURCES[gender][sid],"error":str(e)[:150]})
 if len(calendars)<8:
  return {"status":"Official NE10 school calendars insufficient; fixtures held",
          "schools_read":len(calendars),"unavailable":unavailable,
          "added":0,"enriched":0}
 sightings=defaultdict(dict);duplicates=0
 for sid,rows in calendars.items():
  for date,away,home,owner,tipoff in rows:
   if any(x not in ids for x in (owner,away,home)):
    rejected+=1;continue
   key=date,away,home
   if owner in sightings[key]:
    sightings[key][owner]=None;duplicates+=1
   else:sightings[key][owner]=(sid,tipoff)
 existing=defaultdict(list)
 for ident,g in games.items():
  if g.get("date") and g.get("away") and g.get("home"):
   existing[(g["date"],frozenset((g["away"],g["home"])))].append((ident,g))
 added=enriched=one_sided=conflicts=time_conflicts=times_added=0
 for (date,away,home),votes in sorted(sightings.items()):
  if set(votes)!={away,home} or any(x is None for x in votes.values()):
   one_sided+=1;continue
  ai,hi=ids[away],ids[home]
  key=date,frozenset((ai,hi))
  prior=existing.get(key,[])
  if len(prior)>1:conflicts+=1;continue
  urls=sorted(BASE+str(x[0]) for x in votes.values())
  local_times=[x[1] for x in votes.values()]
  tip=local_times[0] if local_times[0] and local_times[0]==local_times[1] else None
  if all(local_times) and local_times[0]!=local_times[1]:time_conflicts+=1
  if prior:
   old=prior[0][1]
   if old.get("away")!=ai or old.get("home")!=hi or old.get("neutral"):
    conflicts+=1;continue
   before=(old.get("official_schedule_sources"),old.get("start_time"))
   old["official_schedule_sources"]=sorted(set(old.get("official_schedule_sources") or []).union(urls))
   if tip and not old.get("start_time"):
    old["start_time"]=tip;old["tipoff_source_url"]=urls[0];times_added+=1
   if before!=(old["official_schedule_sources"],old.get("start_time")):enriched+=1
   continue
  if dt.date.fromisoformat(date)<today:continue
  gid=f"d2ne10-2026-{gender}-{date}-{away}-{home}"
  if gid in games:conflicts+=1;continue
  game={"id":gid,"date":date,"away":ai,"home":hi,"away_score":None,"home_score":None,
        "status":"scheduled","verified":True,"elo_eligible":True,"neutral":False,
        "conference_game":True,"source":"NE10 2026-27 official reciprocal school calendars",
        "source_url":urls[0],"official_schedule_sources":urls}
  if tip:
   game["start_time"]=tip;game["tipoff_source_url"]=urls[0];times_added+=1
  games[gid]=game
  existing[key].append((gid,game));added+=1
 return {"status":"NE10 2026-27 exact reciprocal school fixtures verified",
         "gender":gender,"schools_read":len(calendars),
         "teams_identified":len(ids),"confirmed_matchups":added+enriched,
         "added":added,"enriched":enriched,"official_tipoffs":times_added,
         "one_sided":one_sided,"quarantined":rejected+conflicts+duplicates,
         "time_conflicts":time_conflicts,"unavailable":unavailable,
         "source":"Northeast-10 Conference official university calendars"}

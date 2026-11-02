#!/usr/bin/env python3
"""2026-27 GLVC and Sunshine State school-by-school DII basketball recovery.

Exact 2026-27 official conference school calendars are source candidates,
never synthetic games. A fixture needs two distinct school observations with
matching date, home/away, gender and conference membership. Existing NCAA
game IDs, verified scores, results and Elo remain unchanged.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

BASES = {"GLVC": "https://glvcsports.com/schedule.aspx?schedule=",
         "SSC": "https://sunshinestateconference.com/schedule.aspx?schedule="}
ALIASES = {
 "GLVC": {
  "drury": ("Drury", "Drury University"),
  "uis": ("Illinois Springfield", "University of Illinois Springfield", "UIS"),
  "indy": ("Indianapolis", "University of Indianapolis", "UIndy"),
  "lewis": ("Lewis", "Lewis University"),
  "lincoln": ("Lincoln", "Lincoln University", "Lincoln University (Missouri)"),
  "maryville": ("Maryville", "Maryville University"),
  "mckendree": ("McKendree", "McKendree University"),
  "mst": ("Missouri S&T", "Missouri S and T", "Missouri University of Science and Technology"),
  "umsl": ("Missouri-St. Louis", "Missouri St. Louis", "University of Missouri St. Louis",
           "University of Missouri-St. Louis"),
  "quincy": ("Quincy", "Quincy University"),
  "rockhurst": ("Rockhurst", "Rockhurst University"),
  "sbu": ("Southwest Baptist", "Southwest Baptist University"),
  "truman": ("Truman", "Truman State", "Truman State University"),
  "upperiowa": ("Upper Iowa", "Upper Iowa University"),
  "jewell": ("William Jewell", "William Jewell College"),
 },
 "SSC": {
  "barry": ("Barry", "Barry University"),
  "eckerd": ("Eckerd", "Eckerd College"),
  "embry": ("Embry-Riddle", "Embry Riddle", "Embry-Riddle Aeronautical University"),
  "flsouthern": ("Florida Southern", "Florida Southern College"),
  "fltech": ("Florida Tech", "Florida Institute of Technology"),
  "lynn": ("Lynn", "Lynn University"),
  "nova": ("Nova Southeastern", "Nova Southeastern University"),
  "pba": ("Palm Beach Atlantic", "Palm Beach Atlantic University"),
  "rollins": ("Rollins", "Rollins College"),
  "saintleo": ("Saint Leo", "Saint Leo University", "St. Leo"),
  "tampa": ("Tampa", "University of Tampa"),
 }}
SOURCES = {
 "GLVC": {
  "men": {6646:"drury",6648:"indy",6690:"lewis",6691:"lincoln",6692:"maryville",
          6693:"mckendree",6694:"mst",6695:"umsl",6696:"quincy",6697:"rockhurst",
          6698:"sbu",6699:"truman",6700:"upperiowa",6701:"jewell",6718:"uis"},
  "women": {6702:"drury",6703:"indy",6706:"lewis",6707:"lincoln",6708:"maryville",
            6709:"mckendree",6710:"mst",6711:"umsl",6712:"quincy",6713:"rockhurst",
            6714:"sbu",6715:"truman",6716:"upperiowa",6717:"jewell",6719:"uis"}},
 "SSC": {
  "men": dict(zip(range(4702,4713),
           ("barry","eckerd","embry","flsouthern","fltech","lynn","nova",
            "pba","rollins","saintleo","tampa"))),
  "women": {4691:"barry",4692:"eckerd",4693:"embry",4694:"flsouthern",
            4695:"fltech",4696:"lynn",4697:"nova",4698:"pba",
            4700:"rollins",4701:"saintleo",4713:"tampa"}}}
CONFERENCE = {"GLVC": {"GLVC", "Great Lakes Valley Conference"},
              "SSC": {"Sunshine State", "Sunshine State Conference"}}
def norm(value):
    return " ".join(re.sub(r"[^a-z0-9]+"," ",
        str(value or "").lower().replace("&"," and ")).split())
LOOKUP={}
for conf,mapping in ALIASES.items():
    lookup={}
    for ident,names in mapping.items():
        for name in names:
            val=norm(name)
            if val in lookup and lookup[val]!=ident:
                raise RuntimeError("Conflicting school alias "+name)
            lookup[val]=ident
    LOOKUP[conf]=lookup

def school(conf,label):
    return LOOKUP[conf].get(norm(label))

def fetch(url):
    req=urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=18) as response:
        return response.read(1_700_000).decode("utf-8","replace")

def eastern_clock(value,conf):
    """GLVC grids explicitly mark Central/Eastern; SSC schools are Eastern."""
    raw=str(value or "").strip().replace(".","")
    match=re.fullmatch(r"(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])M(?:\s*(CT|ET))?",raw,re.I)
    if not match:return None
    hh=int(match[1])%12+(12 if match[3].upper()=="P" else 0)
    minute=int(match[2])
    tz=match[4].upper() if match[4] else ("ET" if conf=="SSC" else None)
    if not tz:return None
    # Convert fixed published local wall clock on the fixture date, including
    # Eastern daylight saving, rather than using a hard-coded UTC offset.
    return hh,minute,tz

def format_et(day,clock):
    if clock is None:return None
    h,minute,zone=clock
    z=ZoneInfo("America/Chicago" if zone=="CT" else "America/New_York")
    instant=dt.datetime.combine(day,dt.time(h,minute),z)
    return instant.astimezone(ZoneInfo("America/New_York")).strftime("%I:%M %p").lstrip("0")+" ET"

def parse(html,conf,gender,sid):
    if conf not in SOURCES or gender not in SOURCES[conf] or sid not in SOURCES[conf][gender]:
        raise ValueError("Unknown official conference/season/school ID")
    soup=BeautifulSoup(html,"html.parser")
    title=(soup.title.get_text(" ",strip=True) if soup.title else "").replace("’","'")
    m=re.search(r"2026-27\s+(.+?)\s+(Men's|Women's)\s+Basketball\b",title,re.I)
    owner=SOURCES[conf][gender][sid]
    if (not m or ("women" if m[2].lower().startswith("women") else "men")!=gender
        or school(conf,m[1])!=owner
        or ("Great Lakes Valley Conference" if conf=="GLVC" else "Sunshine State Conference").lower() not in title.lower()):
        raise ValueError("Wrong 2026-27 official school, gender, or conference: "+str(sid))
    data=[];rejected=0;found=False
    for table in soup.select("table"):
        headers=[norm(x.get_text(" ",strip=True)) for x in table.select("tr th")]
        if not {"date","opponent","location","time result"}.issubset(set(headers)):
            continue
        league_header="ssc" if conf=="SSC" else "c"
        if league_header not in headers:continue
        found=True
        idx=[headers.index(x) for x in ("date",league_header,"opponent","location","time result")]
        for tr in table.select("tr"):
            cells=[x.get_text(" ",strip=True) for x in tr.find_all("td",recursive=False)]
            if len(cells)<=max(idx):continue
            date_raw,flag,rival_raw,location,time_raw=[cells[i].strip() for i in idx]
            if "*" not in flag:continue  # exact official conference games only
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",date_raw):
                rejected+=1;continue
            try:day=dt.datetime.strptime(date_raw,"%m/%d/%Y").date()
            except ValueError:rejected+=1;continue
            if not dt.date(2026,11,1)<=day<=dt.date(2027,3,1):continue
            if re.match(r"^(vs\.?|versus)\s+",rival_raw,re.I):
                rejected+=1;continue # neutral site cannot be made a home fixture
            away_label=bool(re.match(r"^at\s+",rival_raw,re.I))
            rival=school(conf,re.sub(r"^at\s+","",rival_raw,flags=re.I))
            if not rival or rival==owner:
                rejected+=1;continue
            away,home=(owner,rival) if away_label else (rival,owner)
            clock=eastern_clock(time_raw,conf)
            tipoff=format_et(day,clock)
            data.append((day.isoformat(),away,home,owner,tipoff))
        break
    if not found or len(data)<8:
        raise ValueError("Official calendar has fewer than eight valid conference fixtures: "+str(sid))
    return data,rejected

def identities(conf,teams):
    matched={};duplicates=set()
    for ident,record in teams.items():
        if record.get("conference") not in CONFERENCE[conf]:continue
        known=school(conf,record.get("name"))
        if not known:continue
        if known in matched and matched[known]!=ident:duplicates.add(known)
        else:matched[known]=ident
    for name in duplicates:matched.pop(name,None)
    return matched,duplicates

def enrich(conf,gender,games,teams,today=None,fetcher=fetch):
    if conf not in SOURCES or gender not in SOURCES[conf]:
        raise ValueError("Invalid DII conference or gender")
    today=today or dt.date.today()
    team_index,ambiguities=identities(conf,teams)
    expected=len(SOURCES[conf][gender])
    if len(team_index)!=expected or ambiguities:
        return {"status":"Conference institutional identity unresolved; fixtures withheld",
                "teams_identified":len(team_index),"target_teams":expected,
                "ambiguous":sorted(ambiguities),"added":0,"enriched":0}
    schedules={};errors=[];rejected=0
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs={pool.submit(fetcher,BASES[conf]+str(sid)):sid for sid in SOURCES[conf][gender]}
        for job in as_completed(jobs):
            sid=jobs[job]
            try:
                rows,bad=parse(job.result(),conf,gender,sid)
                schedules[sid]=rows;rejected+=bad
            except Exception as exc:
                errors.append({"source":sid,"school":SOURCES[conf][gender][sid],
                               "error":str(exc)[:155]})
    min_schools=12 if conf=="GLVC" else 9
    if len(schedules)<min_schools:
        return {"status":"Insufficient official university calendars; fixtures withheld",
                "schools_read":len(schedules),"target_schools":expected,
                "unavailable":errors,"added":0,"enriched":0}
    observed=defaultdict(dict)
    duplicates=0
    for sid,rows in schedules.items():
        for day,away,home,owner,clock in rows:
            key=(day,away,home)
            if owner in observed[key]:
                duplicates+=1;observed[key][owner]=None
            else:observed[key][owner]=(sid,clock)
    existing=defaultdict(list)
    for game in games.values():
        if game.get("date") and game.get("away") and game.get("home"):
            key=(game["date"],frozenset((game["away"],game["home"])))
            existing[key].append(game)
    added=enriched=one_sided=conflicts=time_conflicts=official_tipoffs=0
    for (date,away,home),votes in sorted(observed.items()):
        if set(votes)!={away,home} or any(value is None for value in votes.values()):
            one_sided+=1;continue
        a,h=team_index[away],team_index[home]
        key=(date,frozenset((a,h)))
        current=existing.get(key,[])
        if len(current)>1:
            conflicts+=1;continue
        urls=sorted(BASES[conf]+str(x[0]) for x in votes.values())
        times=[x[1] for x in votes.values()]
        tipoff=times[0] if times[0] and times[0]==times[1] else None
        if times[0] and times[1] and times[0]!=times[1]:
            time_conflicts+=1
        if current:
            old=current[0]
            if old.get("away")!=a or old.get("home")!=h or old.get("neutral"):
                conflicts+=1;continue
            before=(list(old.get("official_schedule_sources") or []),old.get("start_time"))
            old["official_schedule_sources"]=sorted(set(before[0]).union(urls))
            if tipoff and not old.get("start_time"):
                old["start_time"]=tipoff
                old["tipoff_source_url"]=urls[0]
                official_tipoffs+=1
            if before!=(old["official_schedule_sources"],old.get("start_time")):
                enriched+=1
            continue
        if dt.date.fromisoformat(date)<today:
            continue # past game without verified final cannot be synthesized
        gid=f"d2{conf.lower()}-2026-{gender}-{date}-{away}-{home}"
        if gid in games:conflicts+=1;continue
        game={"id":gid,"date":date,"away":a,"home":h,
              "away_score":None,"home_score":None,"status":"scheduled",
              "verified":True,"elo_eligible":True,"neutral":False,
              "conference_game":True,
              "source":f"{conf} 2026-27 reciprocal official school calendars",
              "source_url":urls[0],"official_schedule_sources":urls}
        if tipoff:
            game["start_time"]=tipoff
            game["tipoff_source_url"]=urls[0]
            official_tipoffs+=1
        games[gid]=game
        existing[key].append(game)
        added+=1
    return {"status":f"{conf} 2026-27 two-university fixture verification",
            "gender":gender,"schools_read":len(schedules),
            "target_schools":expected,"confirmed_matchups":added+enriched,
            "added":added,"enriched":enriched,"official_tipoffs":official_tipoffs,
            "one_sided":one_sided,"time_conflicts":time_conflicts,
            "quarantined":rejected+conflicts+duplicates,
            "unavailable":errors,"source":BASES[conf],
            "scores_preserved":True,"fixture_ids_preserved":True}

#!/usr/bin/env python3
"""Strict 2026-27 SIAC men's/women's basketball two-university schedules.

Every candidate institution / gender / season must be identified from its
actual official SIAC calendar heading. The 15 men's and 14 women's source
IDs are NOT treated as proof of a fixture on their own. Only matching
university A and B observations with identical date, away and home create
a conference game. Existing NCAA results/IDs are never overwritten.
An ET time is added only if both institutions explicitly agree in ET.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup

BASE="https://thesiac.com/schedule.aspx?schedule="
LABELS=("Albany State","Allen","Benedict","Central State","Clark Atlanta",
        "Edward Waters","Fort Valley State","Kentucky State","Lane",
        "LeMoyne-Owen","Miles","Morehouse","Savannah State","Spring Hill","Tuskegee")
MEN_IDS=(2785,2786,2787,2788,2789,2790,2791,2792,2793,2794,2795,2796,2797,2798,2799)
WOMEN_IDS=(2800,2801,2802,2803,2804,2805,2806,2807,2808,2809,2810,2811,2812,2813)
SOURCES={"men":dict(zip(MEN_IDS,LABELS)),
         "women":dict(zip(WOMEN_IDS,(x for x in LABELS if x!="Morehouse")))}
ALIASES={
 "albany":("albany state","albany state university","albany state university georgia"),
 "allen":("allen","allen university"),
 "benedict":("benedict","benedict college"),
 "central":("central state","central state university"),
 "clark":("clark atlanta","clark atlanta university"),
 "edward":("edward waters","edward waters university"),
 "fortvalley":("fort valley state","fort valley state university"),
 "kentucky":("kentucky state","kentucky state university"),
 "lane":("lane","lane college"),
 "lemoyne":("lemoyne owen","lemoyne owen college"),
 "miles":("miles","miles college"),
 "morehouse":("morehouse","morehouse college"),
 "savannah":("savannah state","savannah state university"),
 "springhill":("spring hill","spring hill college"),
 "tuskegee":("tuskegee","tuskegee university"),
}
def norm(value):
    return " ".join(re.sub(r"[^a-z0-9 ]"," ",str(value or "").lower()).split())
NAMES={norm(label):ident for ident,labels in ALIASES.items() for label in labels}
def school(name):return NAMES.get(norm(name))

def fetch(url):
    req=urllib.request.Request(url,headers={
      "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
      "Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=18) as response:
        return response.read(1_700_000).decode("utf-8","replace")

def explicit_et(raw):
    match=re.fullmatch(r"\s*(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?\s*ET\s*",
                       str(raw or ""),re.I)
    if match:
        return f"{int(match[1])}:{match[2]} {match[3].upper()}M ET"
    return None

def parse(html,gender,sid):
    if sid not in SOURCES.get(gender,{}):
        raise ValueError("Unknown SIAC gender-specific school calendar")
    soup=BeautifulSoup(html,"html.parser")
    heading=" ".join([soup.title.get_text(" ",strip=True) if soup.title else ""]+
         [h.get_text(" ",strip=True) for h in soup.find_all(["h1","h2"],limit=3)])
    heading=heading.replace("’","'")
    match=re.search(r"2026-27\s+(.+?)\s+(men's|women's)\s+basketball",heading,re.I)
    expected=SOURCES[gender][sid]
    if (not match or
        ("women" if match[2].lower().startswith("women") else "men")!=gender or
        school(match[1])!=school(expected)):
        raise ValueError(f"Wrong SIAC 2026-27 school, gender or title: {sid}")
    owner=school(expected)
    rows=[];bad=0;found=False
    for table in soup.select("table"):
        headers=norm(" ".join(x.get_text(" ",strip=True) for x in table.select("th")))
        if not all(v in headers for v in ("date","conference game","opponent","location")):
            continue
        found=True
        for tr in table.select("tr"):
            cells=[" ".join(x.get_text(" ",strip=True).split())
                   for x in tr.find_all(["td","th"],recursive=False)]
            if len(cells)<5 or "*" not in cells[1]:continue
            d,conf,opponent,location,clock=cells[:5]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",d):
                bad+=1;continue
            try:day=dt.datetime.strptime(d,"%m/%d/%Y").date()
            except ValueError:bad+=1;continue
            if not dt.date(2026,11,1)<=day<=dt.date(2027,3,1):continue
            if re.match(r"^vs\.?\s+",opponent,re.I):
                bad+=1;continue
            at=bool(re.match(r"^at\s+",opponent,re.I))
            rival=school(re.sub(r"^at\s+","",opponent,flags=re.I))
            if not rival or rival==owner or (gender=="women" and rival=="morehouse"):
                bad+=1;continue
            away,home=(owner,rival) if at else (rival,owner)
            rows.append((day.isoformat(),away,home,owner,explicit_et(clock)))
        break
    if not found or len(rows)<8:
        raise ValueError(f"SIAC calendar missing full 2026-27 conference schedule: {sid}")
    return rows,bad

def index(teams):
    found={};conflicts=set()
    for ident,t in teams.items():
        if t.get("conference") not in ("SIAC","Southern Intercol. Ath. Conf.",
             "Southern Intercollegiate Athletic Conference"):
            continue
        key=school(t.get("name")) or school(str(ident).replace("-"," "))
        if not key:continue
        if key in found and found[key]!=ident:conflicts.add(key)
        else:found[key]=ident
    for key in conflicts:found.pop(key,None)
    return found,conflicts

def enrich_siac(gender,games,teams,today=None,fetcher=fetch):
    if gender not in SOURCES:raise ValueError("Only independent DII men's/women's ledgers")
    today=today or dt.date.today()
    ids,conflicts=index(teams)
    expected=15 if gender=="men" else 14
    if len(ids)!=expected or conflicts:
        return {"status":"SIAC member identity incomplete; games held",
                "teams_identified":len(ids),"added":0,"enriched":0}
    sources={};errors=[];rejected=0
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
        for task in as_completed(jobs):
            sid=jobs[task]
            try:
                rows,bad=parse(task.result(),gender,sid)
                sources[sid]=rows
                rejected+=bad
            except Exception as exc:
                errors.append({"source_id":sid,"school":SOURCES[gender][sid],
                               "reason":str(exc)[:170]})
    if len(sources)<expected-2:
        return {"status":"SIAC official university sources incomplete; games held",
                "schools_read":len(sources),"unavailable":errors,
                "added":0,"enriched":0}
    observed=defaultdict(dict)
    for sid,rows in sources.items():
        for date,away,home,owner,clock in rows:
            if away not in ids or home not in ids:rejected+=1;continue
            pair=date,away,home
            if owner in observed[pair]:rejected+=1;continue
            observed[pair][owner]=(sid,clock)
    old_games=defaultdict(list)
    for gid,g in games.items():
        if g.get("date") and g.get("away") and g.get("home"):
            old_games[(g["date"],frozenset((g["away"],g["home"])))].append((gid,g))
    added=enriched=conflicts_count=one_sided=times=times_conflict=0
    for (date,away,home),witnesses in sorted(observed.items()):
        if set(witnesses)!={away,home}:one_sided+=1;continue
        a,h=ids[away],ids[home]
        prior=old_games.get((date,frozenset((a,h))),[])
        if len(prior)>1:conflicts_count+=1;continue
        urls=sorted(BASE+str(v[0]) for v in witnesses.values())
        clocks=[v[1] for v in witnesses.values()]
        verified_time=clocks[0] if all(clocks) and clocks[0]==clocks[1] else None
        if all(clocks) and clocks[0]!=clocks[1]:times_conflict+=1
        if prior:
            g=prior[0][1]
            if g["away"]!=a or g["home"]!=h or g.get("neutral"):
                conflicts_count+=1;continue
            merged=sorted(set(g.get("official_schedule_sources") or []).union(urls))
            if merged!=g.get("official_schedule_sources"):
                g["official_schedule_sources"]=merged;enriched+=1
            if verified_time and not g.get("start_time"):
                g["start_time"]=verified_time
                g["tipoff_source_url"]=urls[0]
                times+=1
            continue
        if dt.date.fromisoformat(date)<today:continue
        gid=f"d2siac-2026-{gender}-{date}-{away}-{home}"
        if gid in games:conflicts_count+=1;continue
        record={"id":gid,"date":date,"away":a,"home":h,
                "away_score":None,"home_score":None,"status":"scheduled",
                "neutral":False,"elo_eligible":True,"verified":True,
                "conference_game":True,"source":"SIAC 2026-27 reciprocal official athletic schedules",
                "source_url":urls[0],"official_schedule_sources":urls}
        if verified_time:
            record["start_time"]=verified_time
            record["tipoff_source_url"]=urls[0]
            times+=1
        games[gid]=record
        old_games[(date,frozenset((a,h)))].append((gid,record))
        added+=1
    return {"status":"SIAC 2026-27 exact reciprocal university fixture check",
            "gender":gender,"schools_read":len(sources),"teams_identified":len(ids),
            "confirmed_matchups":sum(set(v)=={a,h} for (_,a,h),v in observed.items()),
            "added":added,"enriched":enriched,"one_sided":one_sided,
            "quarantined":rejected+conflicts_count,
            "conflicts":conflicts_count,"time_conflicts":times_conflict,
            "mutually_verified_eastern_tipoffs":times,"unavailable":errors,
            "source":"https://thesiac.com/schedule.aspx?schedule="}

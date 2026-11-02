#!/usr/bin/env python3
"""2026–27 Peach Belt DII men/women basketball official schedule reconciliation.

The 22 source IDs below were checked against the specific 2026–27 PBC
school, gender and title, NOT inferred from neighboring numeric IDs.
Only date + both exact program IDs + mutually corroborating H/A designation
may enter the ledger. No unsupported results, venues or streams.
Game tipoffs are published in ET only when both official grids agree.
"""
from __future__ import annotations

import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

BASE = "https://peachbeltconference.org/schedule.aspx?schedule="
SCHOOLS = {
    "augusta": ("Augusta", "Augusta University"),
    "clayton": ("Clayton State", "Clayton State University"),
    "columbus": ("Columbus State", "Columbus State University"),
    "flagler": ("Flagler", "Flagler College"),
    "georgia-college": ("GCSU", "Georgia College", "Georgia College and State University",
                        "Georgia College & State University"),
    "georgia-southwestern": ("Georgia Southwestern", "Georgia Southwestern State",
                              "Georgia Southwestern State University"),
    "lander": ("Lander", "Lander University"),
    "middle-georgia": ("Middle Georgia", "Middle Georgia State",
                       "Middle Georgia State University"),
    "north-georgia": ("North Georgia", "University of North Georgia"),
    "usca": ("USCA", "USC Aiken", "University of South Carolina Aiken",
             "University of South Carolina at Aiken"),
    "uscb": ("USC Beaufort", "USCB", "University of South Carolina Beaufort",
             "University of South Carolina at Beaufort"),
}
SOURCES = {
    "men": {
        3505:"augusta",3556:"clayton",3499:"columbus",3564:"flagler",
        3558:"georgia-college",3507:"georgia-southwestern",3560:"lander",
        3566:"middle-georgia",3509:"north-georgia",3502:"usca",3567:"uscb",
    },
    "women": {
        3506:"augusta",3557:"clayton",3500:"columbus",3569:"flagler",
        3559:"georgia-college",3508:"georgia-southwestern",3561:"lander",
        3565:"middle-georgia",3510:"north-georgia",3501:"usca",3568:"uscb",
    }
}
def normal(text):
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", str(text or "").lower()).split())

ALIASES = {normal(alias): k for k, names in SCHOOLS.items() for alias in names}
assert len(SOURCES["men"]) == len(SOURCES["women"]) == 11
assert not set(SOURCES["men"]).intersection(SOURCES["women"])
assert len(ALIASES) == sum(map(len, SCHOOLS.values()))

def school(label):
    return ALIASES.get(normal(label))

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req, timeout=18) as response:
        return response.read(1_800_000).decode("utf-8","replace")

def time_et(raw):
    """PBC campuses are in US Eastern; only a valid unambiguous clock is admitted."""
    m = re.fullmatch(r"\s*(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?\s*", str(raw or ""), re.I)
    if not m:return None
    return f"{int(m[1])}:{m[2]} {m[3].upper()}M ET"

def parse(html, gender, sid):
    if sid not in SOURCES.get(gender, {}):
        raise ValueError("Unrecognized Peach Belt source ID or gender")
    soup = BeautifulSoup(html,"html.parser")
    headings = ([soup.title.get_text(" ",strip=True) if soup.title else ""]+
                [h.get_text(" ",strip=True) for h in soup.find_all(["h1","h2"],limit=3)])
    heading = " ".join(headings).replace("’","'")
    marker = re.search(r"2026-27\s+(.+?)\s+(Men's|Women's)\s+Basketball",heading,re.I)
    if not marker:
        raise ValueError(f"Not an official 2026-27 PBC basketball calendar: {sid}")
    found_gender = "women" if marker[2].lower().startswith("women") else "men"
    owner = school(marker[1])
    if found_gender != gender or owner != SOURCES[gender][sid]:
        raise ValueError(f"Official PBC school/gender mismatch: {sid}")
    rows=[];bad=0;table_found=False
    for table in soup.select("table"):
        headers=normal(" ".join(x.get_text(" ",strip=True) for x in table.select("th")))
        if not all(x in headers for x in ("date","opponent","notes","result")):
            continue
        table_found=True
        for tr in table.select("tr"):
            cells=[" ".join(t.get_text(" ",strip=True).split())
                   for t in tr.find_all(["td","th"],recursive=False)]
            if len(cells)<4:continue
            date,opponent,notes,posted=cells[:4]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",date):
                bad+=1;continue
            try:when=dt.datetime.strptime(date,"%m/%d/%Y").date()
            except ValueError:
                bad+=1;continue
            if not dt.date(2026,11,1)<=when<=dt.date(2027,3,1):continue
            if re.match(r"^(?:vs\.?|versus)\s+",opponent,re.I):
                bad+=1;continue
            at=bool(re.match(r"^at\s+",opponent,re.I))
            rival=school(re.sub(r"^at\s+","",opponent,flags=re.I))
            if rival is None:continue  # nonconference opponent, NOT necessarily wrong
            if rival==owner:
                bad+=1;continue
            away,home=(owner,rival) if at else (rival,owner)
            rows.append((when.isoformat(),away,home,owner,time_et(posted)))
        break
    if not table_found or len(rows)<8:
        raise ValueError(f"PBC 2026-27 source missing full conference slate: {sid}")
    return rows,bad

def identities(teams):
    found={};collisions=set()
    for ident,record in teams.items():
        if record.get("conference") not in ("PBC","Peach Belt Conference"):continue
        key=school(record.get("name")) or school(str(ident).replace("-"," "))
        if key is None:continue
        if key in found and found[key]!=ident:collisions.add(key)
        else:found[key]=ident
    for key in collisions:found.pop(key,None)
    return found,collisions

def enrich_pbc(gender,games,teams,today=None,fetcher=fetch):
    if gender not in SOURCES:raise ValueError("Invalid DII gender")
    today=today or dt.date.today()
    ids,collisions=identities(teams)
    if len(ids)!=11 or collisions:
        return {"status":"PBC registry identity reconciliation pending; fixtures held",
                "teams_identified":len(ids),"ambiguous":sorted(collisions),
                "added":0,"enriched":0}
    calendars={};outages=[];rejected=0
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
        for task in as_completed(jobs):
            sid=jobs[task]
            try:
                rows,bad=parse(task.result(),gender,sid)
                calendars[sid]=rows;rejected+=bad
            except Exception as exc:
                outages.append({"id":sid,"school":SOURCES[gender][sid],
                                "reason":str(exc)[:160]})
    if len(calendars)<9:
        return {"status":"Insufficient independently verified PBC school calendars; fixtures held",
                "schools_read":len(calendars),"unavailable":outages,
                "added":0,"enriched":0}
    observed=defaultdict(dict)
    duplicate_school_rows=0
    for sid,rows in calendars.items():
        for date,away,home,owner,tipoff in rows:
            if owner not in ids or away not in ids or home not in ids:
                rejected+=1;continue
            key=date,away,home
            if owner in observed[key]:
                duplicate_school_rows+=1
                # Same institution reporting duplicate matching records:
                # quarantine the entire matchup rather than guess.
                observed[key][owner]=None
            else:observed[key][owner]=(sid,tipoff)
    existing=defaultdict(list)
    for ident,g in games.items():
        if g.get("date") and g.get("away") and g.get("home"):
            existing[(g["date"],frozenset((g["away"],g["home"])))].append((ident,g))
    added=enriched=one_sided=conflicts=time_conflicts=times_verified=0
    for (date,away,home),votes in sorted(observed.items()):
        if set(votes)!={away,home} or any(v is None for v in votes.values()):
            one_sided+=1;continue
        a,h=ids[away],ids[home]
        key=date,frozenset((a,h))
        previous=existing.get(key,[])
        if len(previous)>1:
            conflicts+=1;continue
        urls=sorted(BASE+str(value[0]) for value in votes.values())
        times=[value[1] for value in votes.values()]
        tipoff=times[0] if times[0] and times[0]==times[1] else None
        if times[0] and times[1] and times[0]!=times[1]:time_conflicts+=1
        if previous:
            old=previous[0][1]
            if old.get("away")!=a or old.get("home")!=h or old.get("neutral"):
                conflicts+=1;continue
            before=(list(old.get("official_schedule_sources") or []),old.get("start_time"))
            old["official_schedule_sources"]=sorted(set(before[0]).union(urls))
            if tipoff and not old.get("start_time"):
                old["start_time"]=tipoff
                old["tipoff_source_url"]=urls[0]
                times_verified+=1
            if before!=(old["official_schedule_sources"],old.get("start_time")):enriched+=1
            continue
        if dt.date.fromisoformat(date)<today:continue
        gid=f"d2pbc-2026-{gender}-{date}-{away}-{home}"
        if gid in games:conflicts+=1;continue
        g={"id":gid,"date":date,"away":a,"home":h,
            "away_score":None,"home_score":None,"status":"scheduled",
            "verified":True,"elo_eligible":True,"neutral":False,
            "conference_game":True,
            "source":"PBC 2026-27 reciprocal official university calendars",
            "source_url":urls[0],"official_schedule_sources":urls}
        if tipoff:
            g["start_time"]=tipoff;g["tipoff_source_url"]=urls[0]
            times_verified+=1
        games[gid]=g
        existing[key].append((gid,g))
        added+=1
    return {"status":"PBC 2026-27 two-school official fixtures verified",
            "gender":gender,"schools_read":len(calendars),"teams_identified":len(ids),
            "confirmed_matchups":added+enriched,"added":added,
            "enriched":enriched,"official_tipoffs":times_verified,
            "one_sided":one_sided,"time_conflicts":time_conflicts,
            "quarantined":rejected+conflicts+duplicate_school_rows,
            "conflicts":conflicts,"unavailable":outages,
            "source":"https://peachbeltconference.org/schedule.aspx?schedule="}

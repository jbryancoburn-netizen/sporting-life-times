#!/usr/bin/env python3
"""2026-27 DII GLVC men's/women's official two-school schedule reconciliation.

Thirty verified conference school-calendar IDs are pinned individually.
A posted conference game requires agreeing independent school calendars:
exact date, opponent IDs, and home/away roles. Dates, times, arena strings
and 2026-27 title/gender/school identity are checked independently; no
guessed tipoffs, no fabricated scores, and no alteration of NCAA results.
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

BASE = "https://glvcsports.com/schedule.aspx?schedule="
# IDs independently located on the GLVC's 2026-27 university schedule pages.
SOURCES = {
    "men": {
        6646:"drury", 6718:"uis", 6648:"indianapolis", 6690:"lewis",
        6691:"lincoln", 6692:"maryville", 6693:"mckendree",
        6694:"mst", 6695:"umsl", 6696:"quincy", 6697:"rockhurst",
        6698:"sbu", 6699:"truman", 6700:"upperiowa", 6701:"jewell",
    },
    "women": {
        6702:"drury", 6719:"uis", 6703:"indianapolis", 6706:"lewis",
        6707:"lincoln", 6708:"maryville", 6709:"mckendree",
        6710:"mst", 6711:"umsl", 6712:"quincy", 6713:"rockhurst",
        6714:"sbu", 6715:"truman", 6716:"upperiowa", 6717:"jewell",
    },
}
SCHOOL_NAMES = {
    "drury": ("Drury", "Drury University"),
    "uis": ("Illinois Springfield", "Illinois-Springfield", "Illinois–Springfield",
            "University of Illinois Springfield", "UIS"),
    "indianapolis": ("Indianapolis", "University of Indianapolis", "UIndy"),
    "lewis": ("Lewis", "Lewis University"),
    "lincoln": ("Lincoln", "Lincoln (MO)", "Lincoln University",
                "Lincoln University (Missouri)"),
    "maryville": ("Maryville", "Maryville University", "Maryville University of Saint Louis"),
    "mckendree": ("McKendree", "McKendree University"),
    "mst": ("Missouri S&T", "Missouri University of Science and Technology",
            "Missouri Science and Technology", "Missouri S and T"),
    "umsl": ("Missouri-St. Louis", "Missouri–St. Louis",
             "University of Missouri-St. Louis", "UMSL",
             "UMSL (Missouri–St. Louis)", "Missouri St Louis"),
    "quincy": ("Quincy", "Quincy University"),
    "rockhurst": ("Rockhurst", "Rockhurst University"),
    "sbu": ("Southwest Baptist", "Southwest Baptist University"),
    "truman": ("Truman", "Truman State", "Truman State University"),
    "upperiowa": ("Upper Iowa", "Upper Iowa University"),
    "jewell": ("William Jewell", "William Jewell College"),
}

def norm(value):
    txt=unicodedata.normalize("NFKD",str(value or "")).replace("–","-").replace("—","-")
    txt=txt.encode("ascii","ignore").decode("ascii").lower().replace("&"," and ")
    return " ".join(re.sub(r"[^a-z0-9]+"," ",txt).split())

ALIASES={}
for institution, labels in SCHOOL_NAMES.items():
    for label in labels:
        token=norm(label)
        if token in ALIASES and ALIASES[token]!=institution:
            raise ValueError(f"GLVC school identity collision: {token}")
        ALIASES[token]=institution

def school(name):
    return ALIASES.get(norm(name))

def fetch(url):
    req=urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req, timeout=18) as response:
        return response.read(1_800_000).decode("utf-8","replace")

def eastern_clock(raw):
    """GLVC source explicitly says CT/ET. Convert only explicit values.

    The Central/Eastern difference is one hour in both standard and
    daylight time. No guessed timezone from the school's location.
    """
    hit=re.fullmatch(
        r"\s*(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?\s*(CT|ET)\s*",
        str(raw or ""),re.I)
    if not hit:
        return None
    hour=int(hit[1]) % 12 + (12 if hit[3].upper()=="P" else 0)
    minute=int(hit[2])
    if hit[4].upper()=="CT":
        hour=(hour+1)%24
    label="AM" if hour<12 else "PM"
    return f"{hour % 12 or 12}:{minute:02d} {label} ET"

def parse(html,gender,sid):
    if gender not in SOURCES or sid not in SOURCES[gender]:
        raise ValueError("Unknown GLVC school calendar ID or gender")
    soup=BeautifulSoup(html,"html.parser")
    title=(soup.title.get_text(" ",strip=True) if soup.title else "").replace("’","'")
    match=re.search(r"2026[-–]27\s+(.+?)\s+(Men's|Women's)\s+Basketball\b",title,re.I)
    if not match:
        raise ValueError("GLVC 2026-27 title missing")
    source_gender="women" if match[2].lower().startswith("women") else "men"
    owner=school(match[1])
    if source_gender!=gender or owner!=SOURCES[gender][sid]:
        raise ValueError(f"GLVC wrong school/season/gender: {sid}")
    parsed=[]
    rejected=0
    found=False
    for table in soup.select("table"):
        for head in table.select("tr"):
            columns=[norm(x.get_text(" ",strip=True))
                     for x in head.find_all("th",recursive=False)]
            # Expected published grid: Date | C | Opponent | Location | Time/Result
            # Use header positions rather than fixed cells for SIDEARM updates.
            if not {"date","c","opponent","location","time result"}.issubset(columns):
                continue
            found=True
            positions={key:columns.index(key) for key in
                       ("date","c","opponent","location","time result")}
            for tr in table.select("tr"):
                cells=[x.get_text(" ",strip=True) for x in tr.find_all("td",recursive=False)]
                if len(cells)<=max(positions.values()):
                    continue
                marker=cells[positions["c"]]
                if "*" not in marker:
                    continue
                raw_date=cells[positions["date"]].strip()
                if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw_date):
                    rejected+=1
                    continue
                try:
                    date=dt.datetime.strptime(raw_date,"%m/%d/%Y").date()
                except ValueError:
                    rejected+=1
                    continue
                if not dt.date(2026,11,1)<=date<=dt.date(2027,3,1):
                    continue
                opposition=cells[positions["opponent"]].strip()
                if re.search(r"\bexhibition\b",opposition,re.I) or re.match(r"^vs\.?\s",opposition,re.I):
                    rejected+=1
                    continue
                away_role=bool(re.match(r"^at\s+",opposition,re.I))
                other=school(re.sub(r"^at\s+","",opposition,flags=re.I))
                if not other or other==owner:
                    rejected+=1
                    continue
                away,home=(owner,other) if away_role else (other,owner)
                tipoff=eastern_clock(cells[positions["time result"]])
                parsed.append((date.isoformat(),away,home,owner,tipoff))
            break
        if found:
            break
    if not found or len(parsed)<7:
        raise ValueError(f"GLVC 2026-27 official conference grid incomplete: {sid}")
    return owner,parsed,rejected

def identities(gender,teams):
    conference="GLVC" if gender=="men" else "Great Lakes Valley Conference"
    found={}
    ambiguous=set()
    for ident,t in teams.items():
        if t.get("conference")!=conference:
            continue
        key=school(t.get("name"))
        if not key:
            continue
        if key in found and found[key]!=ident:
            ambiguous.add(key)
        else:
            found[key]=ident
    for key in ambiguous:
        found.pop(key,None)
    return found,ambiguous

def enrich_glvc(gender,games,teams,today=None,fetcher=fetch):
    if gender not in SOURCES:
        raise ValueError("Unexpected GLVC gender")
    today=today or dt.date.today()
    ids,ambiguous=identities(gender,teams)
    if len(ids)!=15 or ambiguous:
        return {"status":"GLVC team identity incomplete; fixtures held",
                "gender":gender,"teams_identified":len(ids),
                "ambiguous":sorted(ambiguous),"added":0,"enriched":0}
    calendars={}
    unavailable=[]
    rejected=0
    with ThreadPoolExecutor(max_workers=9) as pool:
        tasks={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
        for future in as_completed(tasks):
            sid=tasks[future]
            try:
                owner,rows,bad=parse(future.result(),gender,sid)
                if owner in calendars:
                    # A university must have exactly one independently
                    # validated school-source ID per gender.
                    calendars[owner]=None
                    rejected+=1
                else:
                    calendars[owner]=(sid,rows)
                rejected+=bad
            except Exception as exc:
                unavailable.append({"id":sid,"school":SOURCES[gender][sid],
                                    "error":str(exc)[:140]})
    if sum(bool(x) for x in calendars.values())<2:
        return {"status":"GLVC independent school calendars insufficient; fixtures held",
                "gender":gender,"schools_read":sum(bool(x) for x in calendars.values()),
                "unavailable":unavailable,"added":0,"enriched":0}
    sightings=defaultdict(dict)
    double_rows=0
    for owner,payload in calendars.items():
        if payload is None:
            continue
        sid,rows=payload
        for date,away,home,witness,clock in rows:
            if any(i not in ids for i in (away,home,witness)):
                rejected+=1
                continue
            key=(date,away,home)
            value=(sid,clock)
            if witness in sightings[key]:
                if sightings[key][witness]!=value:
                    sightings[key][witness]=None
                    double_rows+=1
            else:
                sightings[key][witness]=value
    existing=defaultdict(list)
    for game_id,game in games.items():
        if game.get("date") and game.get("away") and game.get("home"):
            existing[(game["date"],frozenset((game["away"],game["home"])))].append((game_id,game))
    added=enriched=one_sided=conflicts=time_conflicts=time_added=0
    confirmed=0
    for (date,away,home),votes in sorted(sightings.items()):
        if set(votes)!={away,home} or any(v is None for v in votes.values()):
            one_sided+=1
            continue
        confirmed+=1
        ai,hi=ids[away],ids[home]
        before=existing.get((date,frozenset((ai,hi))),[])
        if len(before)>1:
            conflicts+=1
            continue
        links=sorted(BASE+str(v[0]) for v in votes.values())
        clocks=[v[1] for v in votes.values()]
        tipoff=clocks[0] if clocks[0] and clocks[0]==clocks[1] else None
        if all(clocks) and not tipoff:
            time_conflicts+=1
        if before:
            prior=before[0][1]
            if (prior.get("away"),prior.get("home"))!=(ai,hi) or prior.get("neutral"):
                conflicts+=1
                continue
            links_after=sorted(set(prior.get("official_schedule_sources") or []).union(links))
            if links_after!=(prior.get("official_schedule_sources") or []):
                prior["official_schedule_sources"]=links_after
                enriched+=1
            if tipoff and not prior.get("start_time"):
                prior["start_time"]=tipoff
                prior["tipoff_source_url"]=links[0]
                time_added+=1
                enriched+=1
            elif tipoff and prior.get("start_time")!=tipoff:
                time_conflicts+=1  # leave existing NCAA feed untouched
            continue
        if dt.date.fromisoformat(date)<today:
            continue
        game_id=f"d2glvc-2026-{gender}-{date}-{away}-{home}"
        if game_id in games:
            conflicts+=1
            continue
        game={"id":game_id,"date":date,"away":ai,"home":hi,
              "away_score":None,"home_score":None,"status":"scheduled",
              "verified":True,"elo_eligible":True,"neutral":False,
              "conference_game":True,"source":"GLVC 2026-27 reciprocal university calendars",
              "source_url":links[0],"official_schedule_sources":links}
        if tipoff:
            game["start_time"]=tipoff
            game["tipoff_source_url"]=links[0]
            time_added+=1
        games[game_id]=game
        existing[(date,frozenset((ai,hi)))].append((game_id,game))
        added+=1
    return {"status":"GLVC 2026-27 exact two-university fixtures verified",
            "gender":gender,"school_schedules":len(SOURCES[gender]),
            "schools_read":sum(bool(x) for x in calendars.values()),
            "teams_identified":len(ids),"confirmed_matchups":confirmed,
            "added":added,"enriched":enriched,"official_tipoffs":time_added,
            "one_sided":one_sided,"quarantined":rejected+double_rows+conflicts,
            "time_conflicts":time_conflicts,"conflicts":conflicts,
            "unavailable":unavailable,
            "source":"https://glvcsports.com/schedule.aspx?schedule="}

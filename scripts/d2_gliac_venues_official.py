#!/usr/bin/env python3
"""Actual 2026-27 GLIAC basketball arenas from published school game grids.

Not a home-arena dictionary. Every arena attaches to one exact dated game
whose school IDs and home/away designation match a GLIAC reciprocal fixture.
Visiting-school listings may establish an exact away arena only when the
visiting school itself explicitly lists a named gym on that game row.
Unknown/blank/contradictory venues are withheld and audited.
"""
from __future__ import annotations

import datetime as dt
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

try:
    from scripts.d2_gliac_official import member_id
except ImportError:
    from d2_gliac_official import member_id

SOURCES = {
    "men": {
        "davenport": "https://dupanthers.com/sports/mens-basketball/schedule/2026-27?grid=true",
        "grand-valley-state": "https://gvsulakers.com/sports/mens-basketball/schedule/2026-27?grid=true",
        "lake-superior-state": "https://lssulakers.com/sports/mens-basketball/schedule/2026-27?grid=true",
        "michigan-tech": "https://michigantechhuskies.com/sports/mens-basketball/schedule/2026-27?grid=true",
        "northern-michigan": "https://nmuwildcats.com/sports/mens-basketball/schedule/2026-27?grid=true",
    },
    "women": {
        "davenport-university": "https://dupanthers.com/sports/womens-basketball/schedule/2026-27?grid=true",
        "grand-valley-state-university": "https://gvsulakers.com/sports/womens-basketball/schedule/2026-27?grid=true",
        "lake-superior-state-university": "https://lssulakers.com/sports/womens-basketball/schedule/2026-27?grid=true",
        "michigan-technological-university": "https://michigantechhuskies.com/sports/womens-basketball/schedule/2026-27?grid=true",
        "northern-michigan-university": "https://nmuwildcats.com/sports/womens-basketball/schedule/2026-27?grid=true",
    },
}
ARENA_LABEL = re.compile(
    r"\b(arena|gymnasium|gym|fieldhouse|student center|sports center|"
    r"coliseum|pavilion|multipurpose center|court|athletic center)\b", re.I)
BAD_PLACE = ("tba", "unknown", "to be announced", "pending", "tbd")


def clean(value):
    return " ".join(str(value or "").split())


def get_html(url):
    req = urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=22) as response:
        return response.read().decode("utf-8","replace")


def read_game_arenas(html, gender, owner, source_url):
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(html,"html.parser")
    titles=" ".join(clean(h.get_text(" ",strip=True)) for h in
                    soup.select("title,h1,h2,h3"))
    titles_lower=titles.lower()
    sport=("men's basketball" if gender=="men" else "women's basketball")
    # Using literal gender tokens prevents "men's" matching "women's".
    # The year must be in the schedule title, not merely in a footer.
    if not re.search(r"\b2026[-–]27\b",titles_lower) or not re.search(
            r"\b"+sport.replace("'","['’]")+r"\b",titles_lower):
        raise ValueError("Official athletics source is not the 2026-27 "+gender+" basketball schedule")
    if owner not in SOURCES[gender] or source_url!=SOURCES[gender][owner]:
        raise ValueError("School-URL provenance mismatch")
    rows=[]
    for table in soup.select("table"):
        header=clean(" ".join(h.get_text(" ",strip=True) for h in table.select("th"))).lower()
        if not all(t in header for t in ("date","time","at","opponent","location")):
            continue
        for tr in table.select("tr"):
            cells=[clean(td.get_text(" ",strip=True)) for td in tr.find_all(["td","th"],recursive=False)]
            if len(cells)<5:continue
            label,raw_clock,role,opponent,place=cells[:5]
            # Match a concrete named GLIAC opponent and explicit HOME/AWAY.
            # Neutral games do not imply either team's venue.
            if role.strip().lower() not in ("home","away"):
                continue
            match=re.search(r"([A-Za-z]+\s+\d{1,2},\s+202[67])",label)
            if not match:continue
            try:game_date=dt.datetime.strptime(match[1],"%B %d, %Y").date()
            except ValueError:continue
            if not(dt.date(2026,11,1)<=game_date<=dt.date(2027,3,1)):
                continue
            opponent_id=member_id(opponent,gender)
            if not opponent_id or opponent_id==owner:continue
            if "/" not in place:continue
            city,arena=(clean(x) for x in place.split("/",1))
            if not city or not arena or any(bad in arena.lower() for bad in BAD_PLACE):
                continue
            if not ARENA_LABEL.search(arena):
                continue
            away,home=(opponent_id,owner) if role.lower()=="home" else (owner,opponent_id)
            rows.append({
                "date":game_date.isoformat(),"away":away,"home":home,
                "arena":arena,"city":city,"source_school":owner,
                "source_url":source_url,"source_role":role.lower(),
            })
    verified=defaultdict(set)
    for item in rows:
        key=(item["date"],item["away"],item["home"])
        verified[key].add((item["arena"],item["city"]))
    # A duplicate schedule row with disagreeing arenas is not evidence.
    return {key:next(iter(v)) for key,v in verified.items() if len(v)==1}


def enrich_gliac_venues(gender,games,teams):
    if gender not in SOURCES:
        raise ValueError("Unknown DII gender for GLIAC venue audit")
    good=[]
    failed=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(get_html,url):(school,url) for school,url in SOURCES[gender].items()}
        for future in as_completed(jobs):
            owner,url=jobs[future]
            try:
                evidence=read_game_arenas(future.result(),gender,owner,url)
                if len(evidence)<7:
                    raise ValueError(f"school schedule has only {len(evidence)} trusted GLIAC arena entries")
                good.append((owner,url,evidence))
            except Exception as exc:
                failed.append({"school":owner,"source":url,"reason":str(exc)[:150]})
    index=defaultdict(list)
    for game in games.values():
        index[(game.get("date"),game.get("away"),game.get("home"))].append(game)
    stats={"source_schedules":len(good),"evidence_rows":0,"matched":0,
           "enriched":0,"already_present":0,"quarantined_conflicts":0,
           "unmatched":0,"source_errors":sorted(failed,key=lambda x:x["school"]),
           "breakdown":[],"sample_conflicts":[]}
    for school,url,evidence in sorted(good):
        additions=0
        matches=0
        for key,(arena,city) in evidence.items():
            stats["evidence_rows"]+=1
            match=index.get(key,[])
            if len(match)!=1 or not match[0].get("conference_game") or match[0].get("neutral"):
                stats["unmatched"]+=1
                continue
            game=match[0]
            if game.get("away") not in teams or game.get("home") not in teams:
                stats["unmatched"]+=1
                continue
            if any(teams[x].get("not_eligible_for_dii_elo") for x in (key[1],key[2])):
                stats["unmatched"]+=1
                continue
            candidate=arena+" · "+city
            previous=game.get("venue")
            if previous and previous.casefold()!=candidate.casefold():
                stats["quarantined_conflicts"]+=1
                if len(stats["sample_conflicts"])<15:
                    stats["sample_conflicts"].append({"key":key,"previous":previous,
                                                       "new":candidate,"source":url})
                continue
            stats["matched"]+=1
            matches+=1
            if previous:
                stats["already_present"]+=1
                continue
            game["venue"]=candidate
            game["venue_source_url"]=url
            game["venue_source_school"]=school
            stats["enriched"]+=1
            additions+=1
        stats["breakdown"].append({"school":school,"matched":matches,"enriched":additions})
    stats["status"]="exact game-specific university arena sources; conflicting records withheld"
    stats["source"]="2026-27 official GLIAC member university basketball schedules"
    return stats

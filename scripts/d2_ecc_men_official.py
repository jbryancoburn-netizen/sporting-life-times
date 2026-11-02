#!/usr/bin/env python3
"""2026–27 East Coast Conference men's official nine-school calendar recovery.

A season/gender/school validated Sidearm calendar is source evidence only.
Publish fixtures ONLY when both ECC universities agree on date and home/away.
No new scores, broadcasts, venues, or unverified Eastern tipoffs.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup

BASE="https://eccsports.org/schedule.aspx?schedule="
CANDIDATES=tuple(range(2679,2695))
SCHOOLS={
 "daemen":("Daemen","Daemen University","Daemen College"),
 "udc":("District of Columbia","University of the District of Columbia",
        "University of District of Columbia","UDC"),
 "dyouville":("D'Youville","D'Youville University","D'Youville College","D Youville"),
 "mercy":("Mercy","Mercy University","Mercy College"),
 "molloy":("Molloy","Molloy University","Molloy College"),
 "queens":("Queens","Queens (N.Y.)","Queens (NY)","Queens College",
           "Queens College (New York)","Queens College (N.Y.)"),
 "roberts":("Roberts Wesleyan","Roberts Wesleyan University","Roberts Wesleyan College"),
 "stac":("St. Thomas Aquinas","St Thomas Aquinas","St. Thomas Aquinas College"),
 "staten":("Staten Island","College of Staten Island","CUNY Staten Island",
           "The College of Staten Island"),
}
def norm(value):
    return " ".join(re.sub(r"[^a-z0-9]+"," ",str(value or "").lower().replace("’","'")).split())
ALIASES={}
for key,names in SCHOOLS.items():
    for name in names:
        token=norm(name)
        if token in ALIASES and ALIASES[token]!=key:raise ValueError("ECC school alias collision")
        ALIASES[token]=key
def school(value):return ALIASES.get(norm(value))
def fetch(url):
    request=urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(request,timeout=18) as rsp:
        return rsp.read(1_750_000).decode("utf-8","replace")
def parse(html,sid):
    if sid not in CANDIDATES:raise ValueError("Unknown ECC source candidate")
    soup=BeautifulSoup(html,"html.parser")
    title=" ".join([soup.title.get_text(" ",strip=True) if soup.title else ""]+
       [x.get_text(" ",strip=True) for x in soup.find_all(["h1","h2"],limit=3)])
    title=title.replace("’","'")
    if "east coast conference" not in title.lower():
        raise ValueError("Not ECC official school calendar")
    match=re.search(r"2026[-–]27\s+(.+?)\s+Men's\s+Basketball\b",title,re.I)
    if not match:raise ValueError("Wrong season/sport/gender for ECC school calendar")
    owner=school(match[1])
    if owner is None:raise ValueError("Unresolved ECC school-calendar owner")
    data=[];rejected=0;found=False
    for table in soup.select("table"):
        for th_row in table.select("tr"):
            headers=[norm(h.get_text(" ",strip=True))
                     for h in th_row.find_all("th",recursive=False)]
            if not {"date","opponent","status","result"}.issubset(headers):continue
            found=True
            date_index=headers.index("date");opp_index=headers.index("opponent")
            for tr in table.select("tr"):
                cells=[cell.get_text(" ",strip=True) for cell in tr.find_all("td",recursive=False)]
                if len(cells)<=max(date_index,opp_index):continue
                raw_date,opponent=cells[date_index].strip(),cells[opp_index].strip()
                if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw_date):
                    rejected+=1;continue
                try:date=dt.datetime.strptime(raw_date,"%m/%d/%Y").date().isoformat()
                except ValueError:rejected+=1;continue
                if not "2026-11-01"<=date<="2027-03-01":continue
                if "exhibition" in opponent.lower() or re.match(r"^vs\.?\s+",opponent,re.I):
                    rejected+=1;continue
                road=bool(re.match(r"^at\s+",opponent,re.I))
                key=school(re.sub(r"^at\s+","",opponent,flags=re.I))
                if key is None or key==owner:
                    rejected+=1;continue
                away,home=(owner,key) if road else (key,owner)
                data.append((date,away,home,owner))
            break
        if found:break
    if not found or len(data)<8:
        raise ValueError("ECC school grid missing full 2026-27 conference season")
    return owner,data,rejected
def identities(teams):
    found={};ambiguous=set()
    for ident,record in teams.items():
        if record.get("conference") not in ("ECC","East Coast Conference"):continue
        key=school(record.get("name")) or school(str(ident).replace("-"," "))
        if not key or record.get("not_eligible_for_dii_elo"):continue
        if key in found and found[key]!=ident:ambiguous.add(key)
        else:found[key]=ident
    for key in ambiguous:found.pop(key,None)
    return found,ambiguous
def enrich_ecc_men(games,teams,today=None,fetcher=fetch):
    today=today or dt.date.today()
    index,ambiguous=identities(teams)
    if len(index)<8 or ambiguous:
        return {"status":"ECC school directory identity incomplete; fixtures withheld",
                "teams_identified":len(index),"ambiguous":sorted(ambiguous),
                "added":0,"enriched":0}
    sources={};outages=[];rejected=0
    with ThreadPoolExecutor(max_workers=10) as pool:
        tasks={pool.submit(fetcher,BASE+str(i)):i for i in CANDIDATES}
        for future in as_completed(tasks):
            sid=tasks[future]
            try:
                owner,rows,invalid=parse(future.result(),sid)
                if owner in sources:
                    sources[owner]=None;rejected+=len(rows)
                else:sources[owner]=(sid,rows)
                rejected+=invalid
            except Exception as exc:
                outages.append({"id":sid,"reason":str(exc)[:110]})
    found={k:v for k,v in sources.items() if v}
    if len(found)<8:
        return {"status":"Insufficient independent 2026-27 ECC school calendars; held",
                "schools_read":len(found),"added":0,"enriched":0,
                "unavailable":outages}
    votes=defaultdict(dict);duplicate=0
    for owner,(sid,rows) in found.items():
        for day,away,home,witness in rows:
            if away not in index or home not in index:rejected+=1;continue
            ident=day,away,home
            if witness in votes[ident]:
                votes[ident][witness]=None;duplicate+=1
            else:votes[ident][witness]=sid
    earlier=defaultdict(list)
    for game in games.values():
        if game.get("date") and game.get("away") and game.get("home"):
            earlier[(game["date"],frozenset((game["away"],game["home"])))].append(game)
    added=enriched=one_sided=conflicts=confirmed=0
    for (day,away,home),seen in sorted(votes.items()):
        if set(seen)!={away,home} or any(sid is None for sid in seen.values()):
            one_sided+=1;continue
        confirmed+=1
        a,h=index[away],index[home]
        matching=earlier.get((day,frozenset((a,h))),[])
        if len(matching)>1:conflicts+=1;continue
        urls=sorted(BASE+str(sid) for sid in seen.values())
        if matching:
            game=matching[0]
            if game.get("away")!=a or game.get("home")!=h or game.get("neutral"):
                conflicts+=1;continue
            before=list(game.get("official_schedule_sources") or [])
            game["official_schedule_sources"]=sorted(set(before).union(urls))
            if before!=game["official_schedule_sources"]:enriched+=1
            continue
        if dt.date.fromisoformat(day)<today:continue
        gid=f"d2ecc-2026-men-{day}-{away}-{home}"
        if gid in games:conflicts+=1;continue
        game={"id":gid,"date":day,"away":a,"home":h,"status":"scheduled",
              "away_score":None,"home_score":None,"verified":True,
              "neutral":False,"elo_eligible":True,"conference_game":True,
              "source":"ECC 2026-27 two-university official schedules",
              "source_url":urls[0],"official_schedule_sources":urls}
        games[gid]=game
        earlier[(day,frozenset((a,h)))].append(game)
        added+=1
    return {"status":"ECC 2026-27 official two-university men's matchups verified",
            "gender":"men","source_school_calendars":len(found),
            "teams_identified":len(index),"reciprocal_games":confirmed,
            "added":added,"enriched":enriched,
            "one_sided":one_sided,"quarantined":rejected+duplicate+conflicts,
            "unavailable":outages,"source":BASE}

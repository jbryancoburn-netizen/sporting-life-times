#!/usr/bin/env python3
"""DII East Coast Conference 2026-27 university basketball schedule reconciliation.

ECC SIDEARM school schedule IDs are source *candidates*, not verified games.
Every source must independently state the correct 2026-27 university, sport
and gender. Opposite-school witnesses must agree on date and away/home before
a DII conference matchup can enter the published men/women game ledger.
Unknown, disputed, neutral, exhibition and single-source fixtures are held.
NCAA game IDs, final scores and fitted independent 1500-reset Elo stay intact.
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

BASE="https://eccsports.org/schedule.aspx?schedule="
# 2026-27 ECC university grids occupy this contiguous SIDEARM interval.
# Deliberately scan candidate IDs and validate the actual university title.
# An ID that is 404/500, stale, mislabeled, or from another sport is rejected.
CANDIDATE_IDS=tuple(range(2679,2701))
SCHOOL_NAMES={
 "csi":("Staten Island","College of Staten Island","CSI"),
 "dyouville":("D'Youville","D'Youville University","D’Youville"),
 "daemen":("Daemen","Daemen University"),
 "mercy":("Mercy","Mercy University"),
 "molloy":("Molloy","Molloy University"),
 "queens":("Queens (N.Y.)","Queens (NY)","Queens College","Queens College (New York)","Queens"),
 "roberts":("Roberts Wesleyan","Roberts Wesleyan University"),
 "stac":("St. Thomas Aquinas","St. Thomas Aquinas College","Saint Thomas Aquinas"),
 "udc":("District of Columbia","University of the District of Columbia","UDC"),
}

def norm(value):
    s=unicodedata.normalize("NFKD",str(value or "")).replace("’","'").replace("–","-")
    s=s.encode("ascii","ignore").decode("ascii").lower().replace("&"," and ")
    return " ".join(re.sub(r"[^a-z0-9]+"," ",s).split())

ALIASES={}
for institution, labels in SCHOOL_NAMES.items():
    for label in labels:
        token=norm(label)
        if token in ALIASES and ALIASES[token]!=institution:
            raise ValueError("ECC institution alias conflict: "+token)
        ALIASES[token]=institution

def school(label):
    return ALIASES.get(norm(label))

def fetch(url):
    req=urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=18) as response:
        return response.read(1_700_000).decode("utf-8","replace")

def eastern_clock(raw):
    """Every ECC basketball home campus uses ET; no ambiguous clock accepted."""
    m=re.fullmatch(r"\s*(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP])\.?M\.?\s*",str(raw or ""),re.I)
    if not m:return None
    return f"{int(m[1])}:{m[2]} {m[3].upper()}M ET"

def parse(html,gender,sid):
    if gender not in ("men","women") or sid not in CANDIDATE_IDS:
        raise ValueError("Unexpected ECC 2026-27 school source")
    soup=BeautifulSoup(html,"html.parser")
    title=(soup.title.get_text(" ",strip=True) if soup.title else "").replace("’","'")
    match=re.search(r"2026[-–]27\s+(.+?)\s+(Men's|Women's)\s+Basketball\b",title,re.I)
    if not match or ("women" if match[2].lower().startswith("women") else "men")!=gender:
        raise ValueError("Wrong ECC 2026-27 season/sport/gender title")
    owner=school(match[1])
    if not owner:
        raise ValueError("Unknown institution on ECC official calendar")
    rows=[]
    rejected=0
    valid_table=False
    for table in soup.select("table"):
        header=None
        for tr in table.select("tr"):
            cells=[norm(th.get_text(" ",strip=True)) for th in tr.find_all("th",recursive=False)]
            if all(item in cells for item in ("date","opponent","result")):
                header=cells
                break
        if header is None:
            continue
        valid_table=True
        pos={col:header.index(col) for col in ("date","opponent","result")}
        for tr in table.select("tr"):
            cols=[x.get_text(" ",strip=True) for x in tr.find_all("td",recursive=False)]
            if len(cols)<=max(pos.values()):
                continue
            raw=cols[pos["date"]].strip()
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw):
                rejected+=1;continue
            try:day=dt.datetime.strptime(raw,"%m/%d/%Y").date()
            except ValueError:rejected+=1;continue
            if not dt.date(2026,11,1)<=day<=dt.date(2027,3,1):
                continue
            opposition=cols[pos["opponent"]].strip()
            if re.search(r"\bexhibition\b",opposition,re.I):
                rejected+=1;continue
            # A 'vs' designation does not prove a home institution.
            if re.match(r"^(?:vs\.?|versus)\s+",opposition,re.I):
                rejected+=1;continue
            at=bool(re.match(r"^at\s+",opposition,re.I))
            other=school(re.sub(r"^at\s+","",opposition,flags=re.I))
            if not other or other==owner:
                rejected+=1;continue
            away,home=(owner,other) if at else (other,owner)
            rows.append((day.isoformat(),away,home,owner,eastern_clock(cols[pos["result"]])))
        break
    if not valid_table or not rows:
        raise ValueError("ECC 2026-27 school calendar has no usable conference games")
    return owner,rows,rejected

def identities(gender,teams):
    conference="ECC" if gender=="men" else "East Coast Conference"
    ids={};conflicts=set()
    for ident,t in teams.items():
        if t.get("conference")!=conference:continue
        key=school(t.get("name"))
        if not key:continue
        if key in ids and ids[key]!=ident:conflicts.add(key)
        else:ids[key]=ident
    for key in conflicts:ids.pop(key,None)
    return ids,conflicts

def enrich_ecc(gender,games,teams,today=None,fetcher=fetch):
    if gender not in ("men","women"):raise ValueError("Invalid ECC gender")
    today=today or dt.date.today()
    ids,conflicts=identities(gender,teams)
    if len(ids)!=9 or conflicts:
        return {"status":"ECC member identity unresolved; fixtures held",
                "gender":gender,"teams_identified":len(ids),"ambiguous":sorted(conflicts),
                "added":0,"enriched":0}
    calendars={}
    missing=[]
    bad=0
    duplicates=set()
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures={pool.submit(fetcher,BASE+str(sid)):sid for sid in CANDIDATE_IDS}
        for future in as_completed(futures):
            sid=futures[future]
            try:
                owner,rows,rejected=parse(future.result(),gender,sid)
                if owner in calendars:
                    duplicates.add(owner)
                else:calendars[owner]=(sid,rows)
                bad+=rejected
            except Exception as exc:
                # Candidate IDs may be other genders or stale/unpublished;
                # these are NOT counted as certified school calendars.
                missing.append({"id":sid,"error":str(exc)[:120]})
    for owner in duplicates:calendars.pop(owner,None)
    if len(calendars)<2:
        return {"status":"ECC official school source coverage insufficient; fixtures held",
                "gender":gender,"schools_read":len(calendars),"added":0,"enriched":0,
                "candidate_errors":len(missing),"duplicate_school_sources":sorted(duplicates)}
    sightings=defaultdict(dict)
    row_conflicts=0
    for owner,(sid,rows) in calendars.items():
        for date,away,home,witness,tipoff in rows:
            if any(k not in ids for k in (away,home,witness)):
                bad+=1;continue
            key=(date,away,home)
            evidence=(sid,tipoff)
            if witness in sightings[key]:
                if sightings[key][witness]!=evidence:
                    sightings[key][witness]=None
                    row_conflicts+=1
            else:sightings[key][witness]=evidence
    existing=defaultdict(list)
    for gid,game in games.items():
        if game.get("date") and game.get("away") and game.get("home"):
            existing[(game["date"],frozenset((game["away"],game["home"])))].append((gid,game))
    added=enriched=matched=one_sided=conflicted=time_disagreements=times_added=0
    for (date,away,home),votes in sorted(sightings.items()):
        if set(votes)!={away,home} or any(v is None for v in votes.values()):
            one_sided+=1;continue
        matched+=1
        ai,hi=ids[away],ids[home]
        present=existing.get((date,frozenset((ai,hi))),[])
        if len(present)>1:
            conflicted+=1;continue
        urls=sorted(BASE+str(entry[0]) for entry in votes.values())
        clocks=[entry[1] for entry in votes.values()]
        tip=clocks[0] if clocks[0] and clocks[0]==clocks[1] else None
        if all(clocks) and not tip:time_disagreements+=1
        if present:
            game=present[0][1]
            if (game.get("away"),game.get("home"))!=(ai,hi) or game.get("neutral"):
                conflicted+=1;continue
            old_urls=game.get("official_schedule_sources") or []
            updated=sorted(set(old_urls).union(urls))
            changed=False
            if updated!=old_urls:
                game["official_schedule_sources"]=updated
                changed=True
            if tip and not game.get("start_time"):
                game["start_time"]=tip
                game["tipoff_source_url"]=urls[0]
                times_added+=1;changed=True
            elif tip and game.get("start_time")!=tip:
                time_disagreements+=1
            if changed:enriched+=1
            continue
        if dt.date.fromisoformat(date)<today:
            continue
        gid=f"d2ecc-2026-{gender}-{date}-{away}-{home}"
        if gid in games:
            conflicted+=1;continue
        game={"id":gid,"date":date,"away":ai,"home":hi,"away_score":None,
              "home_score":None,"status":"scheduled","verified":True,
              "elo_eligible":True,"neutral":False,"conference_game":True,
              "source":"ECC 2026-27 two-university official school schedules",
              "source_url":urls[0],"official_schedule_sources":urls}
        if tip:
            game["start_time"]=tip
            game["tipoff_source_url"]=urls[0]
            times_added+=1
        games[gid]=game
        existing[(date,frozenset((ai,hi)))].append((gid,game))
        added+=1
    return {"status":"ECC 2026-27 exact reciprocal school calendars verified",
            "gender":gender,"schools_read":len(calendars),"teams_identified":len(ids),
            "school_schedules":len(calendars),"confirmed_matchups":matched,
            "added":added,"enriched":enriched,"one_sided":one_sided,
            "quarantined":bad+row_conflicts+conflicted,
            "conflicts":conflicted,"time_conflicts":time_disagreements,
            "official_tipoffs":times_added,
            "missing_schools":sorted(set(ids)-set(calendars)),
            "duplicate_school_sources":sorted(duplicates),
            "source":"East Coast Conference official 2026-27 university calendars"}

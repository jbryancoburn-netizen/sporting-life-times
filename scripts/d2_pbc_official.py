#!/usr/bin/env python3
"""Exact 2026-27 Peach Belt men's/women's school schedule reconciliation.

2026-27 PBC school calendar rows have no reliable conference asterisk.
Consequently a DII conference fixture is admitted ONLY when two different
official university calendars independently agree on date, away/home and
gender, and both schools resolve uniquely to that gender's PBC directory.
Never infer a venue, score, broadcast, neutral designation or timezone.
Source IDs found near official examples are UNTRUSTED until their page title
proves this precise year, sport and owning school.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup

BASE="https://peachbeltconference.org/schedule.aspx?schedule="
SCHOOLS={
 "augusta":("Augusta","Augusta University"),
 "clayton":("Clayton State","Clayton State University"),
 "columbus":("Columbus State","Columbus State University"),
 "flagler":("Flagler","Flagler College"),
 "georgia-college":("Georgia College","GCSU","Georgia College State University",
                   "Georgia College & State University","Georgia College and State University"),
 "gsw":("Georgia Southwestern","Georgia Southwestern State",
        "Georgia Southwestern State University"),
 "lander":("Lander","Lander University"),
 "middle-georgia":("Middle Georgia","Middle Georgia State",
                  "Middle Georgia State University"),
 "north-georgia":("North Georgia","University of North Georgia"),
 "usca":("USCA","USC Aiken","University of South Carolina Aiken"),
 "uscb":("USC Beaufort","University of South Carolina Beaufort"),
}
def norm(value):
    return " ".join(re.sub(r"[^a-z0-9 ]"," ",str(value or "").lower()).split())
ALIASES={norm(name):key for key,names in SCHOOLS.items() for name in names}
def school(value):
    return ALIASES.get(norm(value))

# These are KNOWN 2026-27 season pages, NOT guessed sequential IDs.
# Remaining exact IDs are discovered by reading and verifying the own-school
# title of nearby PBC pages, then cached for future daily source refreshes.
SEEDS={
 "men":{"augusta":3505,"georgia-college":3558,"gsw":3507,
        "lander":3560,"middle-georgia":3566,"north-georgia":3509},
 "women":{"augusta":3506,"clayton":3557,"columbus":3500,
          "georgia-college":3559,"gsw":3508,"lander":3561,
          "middle-georgia":3565,"north-georgia":3510,
          "usca":3501,"uscb":3568},
}
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":
        "SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=15) as resp:
        return resp.read(1_600_000).decode("utf-8","replace")

def identify(html):
    soup=BeautifulSoup(html,"html.parser")
    title=soup.title.get_text(" ",strip=True) if soup.title else ""
    heading=next((h.get_text(" ",strip=True)
                  for h in soup.find_all(["h1","h2"])
                  if re.search(r"2026-27",h.get_text(" ",strip=True))),"")
    for value in (title,heading):
        value=value.replace("’","'")
        match=re.search(r"2026-27\s+(.+?)\s+(women's|men's)\s+basketball\b",value,re.I)
        if not match:continue
        gender="women" if match.group(2).lower().startswith("women") else "men"
        owner=school(match.group(1))
        if owner:return gender,owner
    return None

def parse(html,gender,owner):
    if identify(html)!=(gender,owner):
        raise ValueError("Wrong official 2026-27 gender, sport or PBC university")
    soup=BeautifulSoup(html,"html.parser")
    rows=[];quarantined=0;found=False
    for table in soup.select("table"):
        headers=norm(" ".join(c.get_text(" ",strip=True) for c in table.select("th")))
        if not all(v in headers for v in ("date","opponent","notes","status")):continue
        found=True
        for tr in table.select("tr"):
            cells=[" ".join(c.get_text(" ",strip=True).split())
                   for c in tr.find_all(["td","th"],recursive=False)]
            if len(cells)<5:continue
            raw,opponent,notes,result,status=cells[:5]
            if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",raw):
                quarantined+=1;continue
            try:date=dt.datetime.strptime(raw,"%m/%d/%Y").date()
            except ValueError:quarantined+=1;continue
            if not dt.date(2026,11,1)<=date<=dt.date(2027,3,1):continue
            if re.match(r"^vs\.?\s+",opponent,re.I):
                quarantined+=1;continue
            at=bool(re.match(r"^at\s+",opponent,re.I))
            rival=school(re.sub(r"^at\s+","",opponent,flags=re.I))
            if rival is None or rival==owner:continue  # non-PBC opponent, or invalid
            away,home=(owner,rival) if at else (rival,owner)
            rows.append((date.isoformat(),away,home,owner))
        break
    if not found or len(rows)<12:
        raise ValueError("PBC source lacks a full 2026-27 conference slate")
    return rows,quarantined

def inspect(ids,gender,fetcher):
    """Resolve IDs only via strict season/sport/owning-institution evidence."""
    found={};duplicates=set();failures=0
    with ThreadPoolExecutor(max_workers=10) as pool:
        tasks={pool.submit(fetcher,BASE+str(sid)):sid for sid in sorted(set(ids))}
        for task in as_completed(tasks):
            sid=tasks[task]
            try:
                html=task.result()
                match=identify(html)
                if match is None or match[0]!=gender:continue
                owner=match[1]
                parse(html,gender,owner)
                if owner in found:duplicates.add(owner)
                else:found[owner]=(sid,html)
            except Exception:failures+=1
    for k in duplicates:found.pop(k,None)
    return found,failures,sorted(duplicates)

def discover(gender,previous,fetcher=fetch):
    prior=(previous or {}).get("source_schedule_ids") or {}
    cached={key:int(value) for key,value in prior.items()
            if key in SCHOOLS and str(value).isdigit() and 3400<=int(value)<=3650}
    targets={**SEEDS[gender],**cached}
    chosen,errors,duplicates=inspect(targets.values(),gender,fetcher)
    if len(chosen)==11:
        return chosen,{"method":"verified 2026-27 exact PBC cached university IDs",
                       "ids_scanned":len(set(targets.values())),"failed":errors,
                       "duplicate_source_owners":duplicates}
    # Noncertified season/sport IDs in this numeric interval are ignored.
    # Scan ONLY when official source IDs have not yet been certified; after
    # first successful discovery subsequent refreshes use 11 cached IDs.
    start=range(3480,3591)
    candidates=[i for i in start if i not in set(targets.values())]
    found,more_errors,more_duplicates=inspect(candidates,gender,fetcher)
    for key,pair in found.items():
        if key not in chosen:chosen[key]=pair
        elif chosen[key][0]!=pair[0]:
            # Two verified full slates for one team is ambiguous: withhold it.
            chosen.pop(key,None)
            duplicates.append(key)
    return chosen,{"method":"validated official university title discovery",
                   "ids_scanned":len(candidates)+len(set(targets.values())),
                   "failed":errors+more_errors,
                   "duplicate_source_owners":sorted(set(duplicates+more_duplicates))}

def team_ids(teams):
    ids={};ambiguous=set()
    for ident,t in teams.items():
        if t.get("conference") not in ("PBC","Peach Belt Conference"):continue
        key=school(t.get("name")) or school(ident.replace("-"," "))
        if not key:continue
        if key in ids and ids[key]!=ident:ambiguous.add(key)
        else:ids[key]=ident
    for k in ambiguous:ids.pop(k,None)
    return ids,ambiguous

def merge(games,calendars,team_index,gender,today):
    # Real two-school corroboration is a strictly stronger guarantee than a
    # composite source's single listing. Never create cross-division games.
    sightings=defaultdict(dict)
    rejected=0
    for owner,(sid,rows) in calendars.items():
        for date,away,home,source_school in rows:
            if source_school!=owner or away not in team_index or home not in team_index:
                rejected+=1;continue
            key=(date,away,home)
            if owner in sightings[key]:rejected+=1;continue
            sightings[key][owner]=sid
    previous=defaultdict(list)
    for gid,g in games.items():
        if g.get("date") and g.get("away") and g.get("home"):
            previous[(g["date"],frozenset((g["away"],g["home"])))].append((gid,g))
    added=enriched=conflicts=single=0
    for (date,away,home),owners in sorted(sightings.items()):
        if set(owners)!={away,home}:single+=1;continue
        ai,hi=team_index[away],team_index[home]
        key=(date,frozenset((ai,hi)))
        prior=previous.get(key,[])
        if len(prior)>1:conflicts+=1;continue
        urls=sorted(BASE+str(sid) for sid in owners.values())
        if prior:
            g=prior[0][1]
            if g.get("away")!=ai or g.get("home")!=hi or g.get("neutral"):
                conflicts+=1;continue
            merged=sorted(set(g.get("official_schedule_sources") or []).union(urls))
            if merged!=g.get("official_schedule_sources"):
                g["official_schedule_sources"]=merged
                enriched+=1
            continue
        if dt.date.fromisoformat(date)<today:continue
        gid=f"d2pbc-2026-{gender}-{date}-{away}-{home}"
        if gid in games:conflicts+=1;continue
        games[gid]={"id":gid,"date":date,"away":ai,"home":hi,
            "away_score":None,"home_score":None,"status":"scheduled",
            "neutral":False,"elo_eligible":True,"verified":True,
            "conference_game":True,
            "source":"PBC 2026-27 reciprocal university athletic calendars",
            "source_url":urls[0],"official_schedule_sources":urls}
        previous[key].append((gid,games[gid]))
        added+=1
    return {"added":added,"enriched":enriched,"confirmed_matchups":
        sum(set(owners)=={a,h} for (_,a,h),owners in sightings.items()),
        "one_sided":single,"quarantined":rejected+conflicts,
        "conflicts":conflicts}

def enrich_pbc(gender,games,teams,today=None,previous=None,fetcher=fetch):
    if gender not in SEEDS:raise ValueError("Invalid DII gender")
    today=today or dt.date.today()
    registry,ambiguous=team_ids(teams)
    if len(registry)!=11 or ambiguous:
        return {"status":"PBC school identity unresolved, fixtures withheld",
                "teams_identified":len(registry),"added":0,"enriched":0}
    sources,discovery=discover(gender,previous,fetcher)
    # No partial uncorroborated schedules count as complete. At least nine
    # of the eleven institution calendars must validate before publication.
    if len(sources)<9:
        return {"status":"PBC institution calendar validation incomplete, fixtures withheld",
                "sources_read":len(sources),"source_discovery":discovery,
                "added":0,"enriched":0}
    rows={owner:(sid,parse(html,gender,owner)[0])
          for owner,(sid,html) in sources.items()}
    result=merge(games,rows,registry,gender,today)
    return {"status":"PBC exact reciprocal official source fixtures",
            "gender":gender,"schools_read":len(rows),"teams_identified":len(registry),
            "source_schedule_ids":{k:v[0] for k,v in sources.items()},
            "source_discovery":discovery,
            "source":"Peach Belt Conference 2026-27 official university basketball calendars",
            **result}

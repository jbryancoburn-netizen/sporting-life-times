#!/usr/bin/env python3
"""2026-27 Lone Star Conference men's basketball: official reciprocal calendars.

The LSC lists 17 men and 20 conference games per school. Candidate official
SIDEARM schedule IDs are validated by actual 2026-27 school and gender heading.
Only two separate schools' matching date, opponents and H/A assertions may
create a future fixture. Never synthesize final scores, network or arena.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

BASE="https://lonestarconference.org/schedule.aspx?schedule="
CANDIDATES=tuple(range(4697,4715))
SCHOOLS={
 "angelo":("Angelo State","Angelo State University"),
 "cameron":("Cameron","Cameron University"),
 "dbu":("DBU","Dallas Baptist","Dallas Baptist University"),
 "enm":("Eastern New Mexico","Eastern New Mexico University"),
 "lubbock":("Lubbock Christian","Lubbock Christian University"),
 "midwestern":("Midwestern State","Midwestern State University","MSU Texas"),
 "oc":("Oklahoma Christian","Oklahoma Christian University"),
 "stedwards":("St. Edward's","St Edward's","St. Edward's University","St Edward's University"),
 "stmarys":("St. Mary's","St Mary's","St. Mary's (Texas)","St. Mary's University","St Mary's University (Texas)" ,"St. Mary's (TX)","St. Mary's University (Texas)","Saint Mary's (Texas)")
 "sulross":("Sul Ross State","Sul Ross State University"),
 "tamiu":("Texas A&M International","Texas A&M International University","Texas AM International"),
 "tamuk":("Texas A&M-Kingsville","Texas A&M Kingsville","Texas A&M University-Kingsville"),
 "utd":("UT Dallas","University of Texas at Dallas","Texas-Dallas","Texas Dallas"),
 "utpb":("UT Permian Basin","Texas-Permian Basin","University of Texas Permian Basin",
         "University of Texas of the Permian Basin","Texas Permian Basin"),
 "uttyler":("UT Tyler","University of Texas at Tyler","Texas-Tyler","Texas Tyler"),
 "wtam":("West Texas A&M","West Texas AM","West Texas A&M University"),
 "wnm":("Western New Mexico","Western New Mexico University"),
}
def norm(value):
    value=str(value or "").replace("&"," and ").replace("’","'")
    return " ".join(re.sub(r"[^a-z0-9]+"," ",value.lower()).split())
ALIASES={}
for key,values in SCHOOLS.items():
    for value in values:
        v=norm(value)
        if v in ALIASES and ALIASES[v]!=key:
            raise ValueError("LSC team identity collision "+v)
        ALIASES[v]=key
def school(value):return ALIASES.get(norm(value))
def fetch(url):
    req=urllib.request.Request(url,headers={
        "User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)",
        "Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=18) as rsp:
        return rsp.read(1_650_000).decode("utf-8","replace")
def et_time(date,raw):
    # Conference grid explicitly labels ALL posted start times as CT.
    m=re.fullmatch(r"\s*(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([AP])\.?M\.?\s*",
                   str(raw or ""),re.I)
    if not m:return None
    hour=(int(m[1])%12)+(12 if m[3].upper()=="P" else 0)
    minute=int(m[2] or 0)
    local=dt.datetime.combine(dt.date.fromisoformat(date),dt.time(hour,minute),
                              tzinfo=ZoneInfo("America/Chicago"))
    eastern=local.astimezone(ZoneInfo("America/New_York"))
    return eastern.strftime("%I:%M %p").lstrip("0")+" ET"
def parse(html,sid):
    if sid not in CANDIDATES:raise ValueError("Unexpected source ID")
    soup=BeautifulSoup(html,"html.parser")
    heads=" ".join(h.get_text(" ",strip=True) for h in soup.find_all(["h1","h2"],limit=5))
    m=re.search(r"2026[-–]27\s+(.+?)\s+Men's\s+Basketball\s+Schedule",heads.replace("’","'"),re.I)
    if not m:raise ValueError("Source is not a 2026-27 men's basketball school calendar")
    owner=school(m[1])
    if owner is None:raise ValueError("Unknown LSC source institution: "+m[1])
    found=False;data=[];rejected=0
    for table in soup.select("table"):
        for tr in table.select("tr"):
            cols=[norm(h.get_text(" ",strip=True)) for h in tr.find_all("th",recursive=False)]
            if not {"date","time ct","lsc","opponent","location","result"}.issubset(cols):
                continue
            found=True
            idx={name:cols.index(name) for name in ("date","time ct","lsc","opponent")}
            for row in table.select("tr"):
                cells=[x.get_text(" ",strip=True) for x in row.find_all("td",recursive=False)]
                if len(cells)<=max(idx.values()):continue
                date_raw,clock,mark,opponent=(cells[idx[x]].strip()
                                             for x in ("date","time ct","lsc","opponent"))
                if "*" not in mark:continue
                if not re.fullmatch(r"\d{1,2}/\d{1,2}/20(?:26|27)",date_raw):
                    rejected+=1;continue
                try:date=dt.datetime.strptime(date_raw,"%m/%d/%Y").date().isoformat()
                except ValueError:rejected+=1;continue
                if not "2026-11-01"<=date<="2027-03-01":continue
                if re.match(r"^vs\.?\s+",opponent,re.I):
                    rejected+=1;continue
                away_flag=bool(re.match(r"^at\s+",opponent,re.I))
                opponent=school(re.sub(r"^at\s+","",opponent,flags=re.I))
                if not opponent or opponent==owner:
                    rejected+=1;continue
                away,home=(owner,opponent) if away_flag else (opponent,owner)
                data.append((date,away,home,owner,et_time(date,clock)))
            break
        if found:break
    if not found or len(data)<12:
        raise ValueError("Incomplete LSC official conference fixture table")
    return owner,data,rejected

def identities(teams):
    result={};duplicates=set()
    for tid,record in teams.items():
        if record.get("conference") not in {"LSC","Lone Star Conference"}:continue
        key=school(record.get("name")) or school(str(tid).replace("-"," "))
        if not key or record.get("not_eligible_for_dii_elo"):continue
        if key in result and result[key]!=tid:duplicates.add(key)
        else:result[key]=tid
    for key in duplicates:result.pop(key,None)
    return result,duplicates

def enrich_lsc_men(games,teams,today=None,fetcher=fetch):
    today=today or dt.date.today()
    index,conflicting_schools=identities(teams)
    if len(index)<14 or conflicting_schools:
        return {"status":"LSC member identities incomplete; source fixtures withheld",
                "teams_identified":len(index),"ambiguous":sorted(conflicting_schools),
                "added":0,"enriched":0}
    calendars={};errors=[];rejected=0
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs={pool.submit(fetcher,BASE+str(sid)):sid for sid in CANDIDATES}
        for task in as_completed(jobs):
            sid=jobs[task]
            try:
                owner,rows,bad=parse(task.result(),sid)
                if owner in calendars:
                    # Conflicting official pages for one school are rejected.
                    calendars[owner]=None;rejected+=len(rows)
                else:calendars[owner]=(sid,rows)
                rejected+=bad
            except Exception as exc:
                errors.append({"id":sid,"message":str(exc)[:115]})
    valid={owner:pair for owner,pair in calendars.items() if pair is not None}
    if len(valid)<14:
        return {"status":"Too few verified LSC source calendars; fixtures withheld",
                "schools_read":len(valid),"unavailable":errors,"added":0,"enriched":0}
    seen=defaultdict(dict);duplicates=0
    for owner,(sid,rows) in valid.items():
        for date,away,home,witness,clock in rows:
            if away not in index or home not in index:rejected+=1;continue
            key=(date,away,home)
            if witness in seen[key]:
                seen[key][witness]=None;duplicates+=1
            else:seen[key][witness]=(sid,clock)
    existing=defaultdict(list)
    for g in games.values():
        if g.get("date") and g.get("away") and g.get("home"):
            existing[(g["date"],frozenset([g["away"],g["home"]]))].append(g)
    added=enriched=one_sided=conflicts=times_added=time_disputes=corroborated=0
    for (date,away,home),votes in sorted(seen.items()):
        if set(votes)!={away,home} or any(v is None for v in votes.values()):
            one_sided+=1;continue
        corroborated+=1
        a,h=index[away],index[home]
        key=(date,frozenset((a,h)))
        older=existing.get(key,[])
        if len(older)>1:
            conflicts+=1;continue
        sources=sorted(BASE+str(x[0]) for x in votes.values())
        clock=[x[1] for x in votes.values()]
        tipoff=clock[0] if clock[0] and clock[0]==clock[1] else None
        if clock[0] and clock[1] and clock[0]!=clock[1]:time_disputes+=1
        if older:
            game=older[0]
            if (game.get("away"),game.get("home"))!=(a,h) or game.get("neutral"):
                conflicts+=1;continue
            previous=(game.get("official_schedule_sources"),game.get("start_time"))
            game["official_schedule_sources"]=sorted(set(game.get("official_schedule_sources") or []).union(sources))
            if tipoff and not game.get("start_time"):
                game["start_time"]=tipoff;game["tipoff_source_url"]=sources[0]
                times_added+=1
            if previous!=(game.get("official_schedule_sources"),game.get("start_time")):enriched+=1
            continue
        if dt.date.fromisoformat(date)<today:continue
        gid=f"d2lsc-2026-men-{date}-{away}-{home}"
        if gid in games:conflicts+=1;continue
        game={"id":gid,"date":date,"away":a,"home":h,"status":"scheduled",
              "away_score":None,"home_score":None,"verified":True,"neutral":False,
              "elo_eligible":True,"conference_game":True,
              "source":"LSC 2026-27 reciprocal official university schedules",
              "source_url":sources[0],"official_schedule_sources":sources}
        if tipoff:
            game["start_time"]=tipoff;game["tipoff_source_url"]=sources[0];times_added+=1
        games[gid]=game;existing[key].append(game);added+=1
    return {"status":"LSC 2026-27 two-university men's fixture verification",
            "gender":"men","source_school_calendars":len(valid),"target_schools":17,
            "teams_identified":len(index),"reciprocal_games":corroborated,
            "added":added,"enriched":enriched,"official_tipoffs":times_added,
            "one_sided":one_sided,"time_conflicts":time_disputes,
            "quarantined":rejected+duplicates+conflicts,
            "unavailable":errors,"source":BASE}

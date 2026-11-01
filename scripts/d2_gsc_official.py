#!/usr/bin/env python3
"""Independently reconcile the eleven official Gulf South men's basketball schedules.

Conference-published 2026-27 schedules are the primary source, not ESPN.
Only a date/opponent/home-away match confirmed by BOTH GSC members is admitted.
No schedule entries are scores, no city is misrepresented as a verified arena.
"""
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from zoneinfo import ZoneInfo

ROOT_URL="https://gscsports.org/schedule.aspx?schedule="
STREAM_SOURCE="https://gscsports.org/news/2026/9/23/gsc-announces-2026-27-mens-and-womens-basketball-conference-schedule.aspx"
SCHOOLS={
    3075:("UAH","alabama-huntsville"),
    3076:("AUM","auburn-montgomery"),
    3077:("Christian Brothers","christian-brothers"),
    3078:("Delta State","delta-state"),
    3079:("Lee","lee"),
    3080:("Mississippi Christian","mississippi-christian"),
    3081:("Montevallo","montevallo"),
    3082:("Trevecca Nazarene","trevecca-nazarene"),
    3083:("Union","union"),
    3084:("Valdosta State","valdosta-state"),
    3085:("West Alabama","west-alabama"),
}
ALIASES={
    "uah":"alabama-huntsville","alabama huntsville":"alabama-huntsville",
    "university of alabama in huntsville":"alabama-huntsville",
    "aum":"auburn-montgomery","auburn montgomery":"auburn-montgomery",
    "auburn university at montgomery":"auburn-montgomery",
    "christian brothers":"christian-brothers","christian brothers university":"christian-brothers",
    "delta state":"delta-state","delta state university":"delta-state",
    "lee":"lee","lee university":"lee",
    "mississippi christian":"mississippi-christian","mississippi christian university":"mississippi-christian",
    "montevallo":"montevallo","university of montevallo":"montevallo",
    "trevecca nazarene":"trevecca-nazarene","trevecca":"trevecca-nazarene",
    "union":"union","union university":"union",
    "valdosta state":"valdosta-state","valdosta state university":"valdosta-state",
    "west alabama":"west-alabama","university of west alabama":"west-alabama",
}
def cleaned(text):
    return " ".join(str(text or "").split())

def name_id(label):
    v=cleaned(label).lower()
    v=re.sub(r"^(?:at|vs\\.?|versus)\\s+","",v)
    v=v.replace("–","-").replace("—","-")
    v=re.sub(r"[^a-z0-9 ]+"," ",v)
    v=" ".join(v.split())
    return ALIASES.get(v)

def read_html(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)","Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=20) as response:
        return response.read().decode("utf-8","replace")

def exact_et(value,game_date):
    """Use an explicit published CT/ET designation, never infer a timezone."""
    v=cleaned(value).upper()
    hit=re.search(r"\\b(1[0-2]|0?[1-9]):([0-5]\\d)\\s*([AP])\\.?M\\.?\\s*(CT|ET|CST|CDT|EST|EDT)\\b",v)
    if not hit:return None
    hour=int(hit.group(1))%12+(12 if hit.group(3)=="P" else 0)
    tz=ZoneInfo("America/Chicago" if hit.group(4).startswith("C") else "America/New_York")
    dt_local=dt.datetime.combine(game_date,dt.time(hour,int(hit.group(2))),tzinfo=tz)
    return dt_local.astimezone(ZoneInfo("America/New_York")).strftime("%I:%M %p").lstrip("0")+" ET"

def read_school_schedule(html,school_id,schedule_id):
    """Parse ONLY the conference's dated six-column schedule table."""
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(html,"html.parser")
    expected_title=SCHOOLS[schedule_id][0].lower()
    title=cleaned(soup.get_text(" ",strip=True)).lower()
    if "2026-27" not in title or "men's basketball" not in title or expected_title not in title:
        raise ValueError("Wrong 2026-27 men's schedule for "+str(schedule_id))
    candidates=[]
    for table in soup.select("table"):
        headers=" ".join(cleaned(th.get_text(" ",strip=True)).lower() for th in table.select("th"))
        if not all(k in headers for k in ("opponent","location","conference","date")):
            continue
        rows=[]
        for tr in table.select("tr"):
            fields=[cleaned(td.get_text(" ",strip=True)) for td in tr.find_all(["td","th"],recursive=False)]
            if len(fields)<6:
                continue
            day,opponent,location,homeaway,conference,rawtime=fields[:6]
            if "*" not in conference:
                continue
            if not re.fullmatch(r"\\d{1,2}/\\d{1,2}/20(?:26|27)",day):
                continue
            try:date=dt.datetime.strptime(day,"%m/%d/%Y").date()
            except ValueError:continue
            if date<dt.date(2026,11,1) or date>dt.date(2027,3,1):continue
            other=name_id(opponent)
            role=homeaway.strip().upper()
            if other is None or other==school_id or role not in ("H","A"):
                raise ValueError(f"Unresolved GSC conference opponent/role on {day}: {school_id}, {opponent}, {role}")
            away,home=(other,school_id) if role=="H" else (school_id,other)
            rows.append({"date":date.isoformat(),"away":away,"home":home,
                 "start_time":exact_et(rawtime,date),"city":location,
                 "source_team":school_id,"source_url":ROOT_URL+str(schedule_id)})
        if len(rows)>len(candidates):candidates=rows
    if len(candidates)<17 or len(candidates)>21:
        raise ValueError(f"GSC schedule {schedule_id} yielded {len(candidates)} conference fixtures, expected approximately 20")
    if len({(x["date"],x["away"],x["home"]) for x in candidates})!=len(candidates):
        raise ValueError("Duplicate games on official GSC school schedule "+str(schedule_id))
    return candidates

def reconcile_schedules(school_records,known_games,teams,today):
    """Recover reciprocal fixtures; quarantine discrepancies, never invent finals."""
    grouped=defaultdict(list)
    for school_id,rows in school_records.items():
        for game in rows:
            if game["source_team"]!=school_id:
                raise ValueError("Incorrect official schedule provenance for "+school_id)
            grouped[(game["date"],game["away"],game["home"])].append(game)
    audit={"school_schedules":len(school_records),
           "school_entries":sum(map(len,school_records.values())),
           "confirmed_matchups":0,"new_games":0,"existing_games_enriched":0,
           "unreciprocated":0,"ambiguous":0,"time_conflicts":0,
           "conflicts":[]}
    for key,rows in sorted(grouped.items()):
        date,away,home=key
        sources={row["source_team"] for row in rows}
        if len(rows)!=2 or sources!={away,home}:
            audit["unreciprocated"]+=1
            if len(audit["conflicts"])<25:audit["conflicts"].append({"date":date,"away":away,"home":home,"issue":"not independently corroborated"})
            continue
        if away not in teams or home not in teams or any(teams[x].get("not_eligible_for_dii_elo") for x in (away,home)):
            audit["ambiguous"]+=1
            continue
        audit["confirmed_matchups"]+=1
        duplicates=[g for g in known_games.values() if g.get("date")==date and {g.get("away"),g.get("home")}=={away,home}]
        if len(duplicates)>1 or (duplicates and (duplicates[0]["away"],duplicates[0]["home"])!=(away,home)):
            audit["ambiguous"]+=1
            if len(audit["conflicts"])<25:audit["conflicts"].append({"date":date,"away":away,"home":home,"issue":"existing data identity/home-away conflict"})
            continue
        if duplicates:
            target=duplicates[0]
            audit["existing_games_enriched"]+=1
        elif date>=today.isoformat():
            game_id="gsc-2026-27-"+date+"-"+away+"-"+home
            if game_id in known_games:raise ValueError("GSC game id collision")
            target={"id":game_id,"date":date,"away":away,"home":home,
                "status":"scheduled","away_score":None,"home_score":None,
                "neutral":False,"verified":True,"elo_eligible":True,
                "source":"Gulf South Conference member schedules (reciprocal)",
                "source_url":rows[0]["source_url"]}
            known_games[game_id]=target
            audit["new_games"]+=1
        else:
            audit["ambiguous"]+=1
            continue
        times={row["start_time"] for row in rows if row["start_time"]}
        if len(times)==1:
            target["start_time"]=next(iter(times))
            target["tipoff_source_url"]=rows[0]["source_url"]
        elif len(times)>1:
            audit["time_conflicts"]+=1
            if len(audit["conflicts"])<25:audit["conflicts"].append({"date":date,"away":away,"home":home,"issue":"different posted tipoffs"})
        # Venue name is NOT available from composite conference tables.
        # A neutral location/city string is useful, but not certified as an arena.
        target["network"]="FloCollege"
        target["broadcast_type"]="Streaming (subscription)"
        target["broadcast_source_url"]=STREAM_SOURCE
        target["conference_game"]=True
        target["official_schedule_sources"]=[row["source_url"] for row in rows]
        target["venue_city"]=next((row["city"] for row in rows if row["source_team"]==home and row["city"]),rows[0]["city"])
    return audit

def enrich_gsc(games,teams,today):
    """Fail closed on source outages. Partial scans never certify a full conference."""
    ids=set(value[1] for value in SCHOOLS.values())
    if not ids.issubset(teams):
        return {"status":"incomplete local GSC school registry","missing_teams":sorted(ids-set(teams))}
    records={}
    failures=[]
    for schedule,(label,school_id) in SCHOOLS.items():
        try:
            records[school_id]=read_school_schedule(read_html(ROOT_URL+str(schedule)),school_id,schedule)
        except Exception as exc:
            failures.append({"school":label,"schedule":schedule,"reason":str(exc)[:190]})
    if failures:
        return {"status":"withheld: official conference school schedule(s) unavailable",
                "verified_schedules":len(records),"errors":failures,
                "new_games":0,"confirmed_matchups":0}
    audit=reconcile_schedules(records,games,teams,today)
    audit["status"]="published with unmatched games quarantined"
    audit["source"]="Gulf South Conference 2026-27 official school schedules (both teams)"
    audit["stream_source"]=STREAM_SOURCE
    audit["schedules"]=[ROOT_URL+str(x) for x in SCHOOLS]
    return audit

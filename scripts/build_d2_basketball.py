#!/usr/bin/env python3
"""Build separate NCAA Division II men/women newspaper datasets from NCAA game feeds.
This collector does not invent membership, location, conference, color or player details.
Old Casablanca endpoints were retired for basketball; use NCAA GraphQL with API fallback.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import unicodedata
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
HASH="7287cda610a9326931931080cb3a604828febe6fe3c9016a7e4a36db99efdb7c"
SEASON="2026-27"
USER_AGENT="SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)"
def get_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=18) as response:
        return json.load(response)
def fetch_day(gender, day):
    sport="MBB" if gender=="men" else "WBB"
    date=day.strftime("%Y/%m/%d")
    params={"sportCode":sport,"division":2,"seasonYear":day.year+(1 if day.month>=7 else 0),"contestDate":date}
    qs=urllib.parse.urlencode({"extensions":json.dumps({"persistedQuery":{"version":1,"sha256Hash":HASH}},separators=(',',':')),
        "variables":json.dumps(params,separators=(',',':')),})
    error=None
    for source,url in [
        ("NCAA official GraphQL","https://sdataprod.ncaa.com/?"+qs),
        ("NCAA open scoreboard mirror","https://ncaa-api.henrygd.me/scoreboard/basketball-"+("men" if gender=="men" else "women")+"/d2/"+date)]:
        try:
            raw=get_json(url)
            if raw.get("errors"):raise ValueError(str(raw["errors"])[:250])
            if source=="NCAA official GraphQL":
                records=raw.get("data",{}).get("contests")
                if not isinstance(records,list):raise ValueError("Missing NCAA contests")
                return [normalise_contest(c,date,gender) for c in records],source
            games=raw.get("games")
            if not isinstance(games,list):raise ValueError("Missing scoreboard games")
            return [normalise_legacy(g.get("game",g),date,gender) for g in games],source
        except Exception as exc:
            error=exc
    raise RuntimeError(f"{gender} {date}: {error}")
def slug(value):
    return re.sub(r"[^a-z0-9]+","-",str(value or "").lower()).strip("-")
def school(record):
    names=record.get("names") or {}
    name=record.get("nameShort") or names.get("full") or names.get("short") or record.get("name") or ""
    ident=record.get("seoname") or names.get("seo") or record.get("teamId") or slug(name)
    conf=record.get("conferences") or []
    conference=(conf[0].get("conferenceName") if conf and isinstance(conf[0],dict) else "") or ""
    div=record.get("division") or record.get("divisionCode") or record.get("teamDivision")
    return {"id":slug(ident),"name":name,"slug":slug(record.get("seoname") or names.get("seo") or ident),
        "conference":conference,"d2_confirmed":str(div).lower() in ("2","ii","d2"),"source":"NCAA game scoreboard"}
def normalise_contest(c,date,gender):
    teams=c.get("teams") or []
    home=next((t for t in teams if t.get("isHome") is True),None)
    away=next((t for t in teams if t.get("isHome") is False),None)
    if not home or not away:return None
    aa,hh=school(away),school(home)
    status={"F":"final","I":"live","P":"scheduled"}.get(str(c.get("gameState") or "").upper(),"scheduled")
    return game_record(c,aa,hh,date,status,away.get("score"),home.get("score"),bool(away.get("isWinner")),bool(home.get("isWinner")),gender)
def normalise_legacy(c,date,gender):
    away,home=c.get("away") or {},c.get("home") or {}
    if not away or not home:return None
    status={"final":"final","live":"live","pre":"scheduled"}.get(str(c.get("gameState") or "").lower(),"scheduled")
    return game_record(c,school(away),school(home),date,status,away.get("score"),home.get("score"),bool(away.get("winner")),bool(home.get("winner")),gender)
def game_record(c,away,home,date,status,away_score,home_score,away_win,home_win,gender):
    if not away["name"] or not home["name"]:return None
    key=str(c.get("contestId") or c.get("gameID") or c.get("id") or f'{date}-{away["id"]}-{home["id"]}')
    try: away_score=int(away_score)
    except (ValueError,TypeError):away_score=None
    try: home_score=int(home_score)
    except (ValueError,TypeError):home_score=None
    if status=="final" and (away_score is None or home_score is None or away_score==home_score):
        status="unverified"
    url=c.get("url") or ""
    if url and url.startswith("/"):url="https://www.ncaa.com"+url
    if not url and key.isdigit():url="https://www.ncaa.com/game/"+key
    eligible=away["d2_confirmed"] and home["d2_confirmed"]
    game={"id":key,"date":date.replace("/","-"),"away":away["id"],"home":home["id"],
        "away_score":away_score,"home_score":home_score,"status":status,"start_time":c.get("startTime") or "",
        "network":c.get("broadcasterName") or c.get("network") or "",
        "source_url":url,"venue":"","elo_eligible":eligible}
    return game,away,home

def seed_directory(gender):
    """Public 2026-27 name/conference facts, independent of NCAA scoreboard game availability.
    The NCAA sport-by-sport directory remains the certification authority.
    """
    from bs4 import BeautifulSoup
    urls={
        "men":"https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_men%27s_basketball_programs",
        "women":"https://www.ncaawomensbasketball.com/blog/d2-womens-basketball-schools-by-state",
    }
    url=urls[gender]
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=24) as response:
        soup=BeautifulSoup(response.read(),"html.parser")
    entries=[]
    for table in soup.select("table"):
        headings=" ".join(t.get_text(" ",strip=True) for t in table.select("tr:first-child th")).lower()
        if gender=="men":
            if not ("team" in headings and "conference" in headings and "city" in headings):
                continue
        else:
            if not ("school" in headings and "conference" in headings and "city" in headings):
                continue
        for tr in table.select("tr"):
            cells=tr.find_all(["th","td"],recursive=False)
            if len(cells)<4 or cells[0].name!="td":continue
            values=[c.get_text(" ",strip=True) for c in cells[:4]]
            if gender=="men":
                name,city,conference=values[0],values[1],values[3]
            else:
                name,city,conference=values[1],values[2],values[3]
            if not name or name.lower() in ("school","team"):continue
            # The membership is a preliminary published roster, not confirmation
            # that all programs are championship eligible.
            entries.append({"id":slug(name),"slug":"","name":name,"city":city,
                            "conference":conference,"d2_confirmed":True,
                            "source":url})
    unique={e["id"]:e for e in entries}
    if len(unique)<250 or len(unique)>310:
        raise RuntimeError(f"Unsafe {gender} directory extraction: {len(unique)} programs from {url}")
    return unique, url


def normalize_school_name(value):
    """Conservative NCAA school-index match: never choose a fuzzy nearest neighbor."""
    value=unicodedata.normalize("NFKD",str(value or "")).encode("ascii","ignore").decode("ascii").lower()
    value=value.replace("&"," and ")
    value=re.sub(r"\b(university|college|of|at|the)\b"," ",value)
    return re.sub(r"[^a-z0-9]","",value)

def seed_official_logos(teams):
    """Match NCAA's authoritative school names to its own SVG logo slugs.

    Ambiguous or absent names remain initials, NEVER another program's logo.
    Both men's and women's editions use the same NCAA school slug for the same
    institution, rather than maintaining different team-specific images.
    """
    sources=["https://www.ncaa.com/json/schools","https://ncaa-api.henrygd.me/schools-index"]
    schools=None;used=None;errors=[]
    for url in sources:
        try:
            candidate=get_json(url)
            if isinstance(candidate,dict):
                candidate=candidate.get("schools") or candidate.get("data")
            if not isinstance(candidate,list) or len(candidate)<800:
                raise ValueError("NCAA school index incomplete or wrong schema")
            schools=candidate;used=url;break
        except Exception as exc:
            errors.append(str(exc)[:180])
    if schools is None:
        return {"matched":sum(bool(t.get("slug")) for t in teams.values()),
                "index_source":None,"error":"NCAA school index unavailable; existing images preserved"}
    by_name={}
    for item in schools:
        slug_value=item.get("slug")
        if not isinstance(slug_value,str) or not re.fullmatch(r"[a-z0-9-]+",slug_value):
            continue
        for label in (item.get("name"),item.get("long_name"),item.get("long")):
            name=normalize_school_name(label)
            if name and len(name)>=5:
                by_name.setdefault(name,set()).add(slug_value)
    matched=0;ambiguous=0
    for t in teams.values():
        if t.get("slug") and t.get("logo_source")=="NCAA schools index":
            matched+=1;continue
        identity=normalize_school_name(t.get("name",""))
        slugs=by_name.get(identity,set())
        if len(slugs)==1:
            t["slug"]=next(iter(slugs))
            t["logo_source"]="NCAA schools index"
            matched+=1
        elif len(slugs)>1:
            ambiguous+=1
    return {"matched":matched,"unmatched":len(teams)-matched,
            "ambiguous":ambiguous,"index_source":used}

def update(gender, bootstrap=False):
    output=DATA/f"d2-{gender}-2026-27.json"
    prior=json.loads(output.read_text()) if output.exists() else {}
    teams={t["id"]:t for t in prior.get("teams",[])}
    directory_source=None
    directory_error=None
    try:
        discovered,directory_source=seed_directory(gender)
        # Do not throw away previously confirmed school-specific details.
        for ident,found in discovered.items():
            teams[ident]={**found,**teams.get(ident,{})}
    except Exception as exc:
        directory_error=str(exc)
        print(f"WARNING: {gender} directory not refreshed: {exc}",file=sys.stderr)
    logo_quality=seed_official_logos(teams)
    games={str(g["id"]):g for g in prior.get("games",[])}
    # CCA-sanctioned Hawaii October tournament games were independently
    # verified against the tournament organizer's published score bracket.
    # They are neutral-site: the first/second teams are NOT home and away.
    tournament_path=DATA/"d2-verified-tournaments-2026-27.json"
    tournament=json.loads(tournament_path.read_text()) if tournament_path.exists() else {}
    tournament_source=tournament.get("source_url","")
    for fixture in tournament.get(gender,[]):
        if fixture["away"] not in teams or fixture["home"] not in teams:
            raise RuntimeError(f"{gender}: official event team not found in directory: {fixture['id']}")
        previous=games.get(fixture["id"])
        # Never roll a final backward to a scheduled game during an import.
        if previous and previous.get("status")=="final" and fixture["status"]!="final":continue
        games[fixture["id"]]={**fixture,"elo_eligible":True,"verified":True}

    today=dt.datetime.now(dt.timezone.utc).date()
    start=dt.date(2026,10,15) if bootstrap else max(dt.date(2026,10,15),today-dt.timedelta(days=12))
    end=dt.date(2027,4,12) if bootstrap else min(dt.date(2027,4,12),today+dt.timedelta(days=30))
    days=[start+dt.timedelta(days=i) for i in range((end-start).days+1)]
    successful=0;errors=[];source_counts={}
    with ThreadPoolExecutor(max_workers=3) as pool:
        tasks={pool.submit(fetch_day,gender,day):day for day in days}
        for job in as_completed(tasks):
            try:records,source=job.result();successful+=1;source_counts[source]=source_counts.get(source,0)+1
            except Exception as exc:errors.append(str(exc));continue
            for item in records:
                if not item:continue
                g,a,h=item
                for school_data in (a,h):
                    ident=school_data.pop("id")
                    previous=teams.get(ident,{})
                    teams[ident]={**previous,**{k:v for k,v in school_data.items() if v not in ("",None)}, "id":ident}
                # NCAA scoreboard home/away team identifiers may differ from
                # the directory's canonical school spellings. Retain the NCAA
                # matchup but do not count unmatched opponents as NCAA DII.
                games[g["id"]]=g
    if successful<max(1,len(days)//2):
        raise RuntimeError(f"{gender}: {successful}/{len(days)} NCAA date requests succeeded. Refusing to publish suspect empty/partial feed. Errors: {errors[:3]}")
    # Ratings start at 1500 on every new season; only NCAA verified DII-v-DII finals count.
    rating={key:1500.0 for key in teams}
    wins={key:0 for key in teams};losses={key:0 for key in teams}
    # Initial explicit uncalibrated settings: no fictitious back-tested coefficients.
    k=20.0;home_edge=65.0
    finals=0
    for game in sorted(games.values(),key=lambda v:(v["date"],v["id"])):
        if not (game["status"]=="final" and game.get("elo_eligible")):continue
        a,h=game["away"],game["home"]
        if a not in rating or h not in rating:continue
        outcome=1 if game["home_score"]>game["away_score"] else 0
        match_edge=0.0 if game.get("neutral") else home_edge
        expectation=1/(1+10**((rating[a]-rating[h]-match_edge)/400))
        movement=k*(outcome-expectation)
        rating[h]+=movement;rating[a]-=movement
        if outcome:wins[h]+=1;losses[a]+=1
        else:wins[a]+=1;losses[h]+=1
        finals+=1
    for key,t in teams.items():
        t["elo"]=round(rating[key],1);t["w"]=wins[key];t["l"]=losses[key]
    ordered=sorted(teams.values(),key=lambda v:v["name"].lower())
    allgames=sorted(games.values(),key=lambda v:(v["date"],v["id"]))
    quality={"status":("DIRECTORY ONLY — NCAA game feed is empty; schedules, records and Elo changes pending" if not allgames
                       else "PARTIAL — 2026-27 DII membership, dates and schedules require school-level verification"),
        "dates_requested":len(days),"dates_fetched":successful,"dates_failed":len(errors),
        "sample_errors":errors[:5],"verified_dii_finals":finals,"programs_found":len(ordered),
        "official_contests_available":any(not str(g.get("id","")).startswith("hih-2026-") for g in allgames),
        "verified_tournament_games":sum(1 for g in allgames if g.get("source")=="official tournament organizer"),
        "verified_tournament_source":tournament_source,
        "directory_source":directory_source,"directory_error":directory_error,
        "official_logo_index":logo_quality,
        "membership_certified":False}
    payload={"season":SEASON,"gender":gender,"division":"II","team_target":298,"starting_elo":1500,
        "as_of":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"NCAA official GraphQL; ncaa-api mirror fallback",
        "model":{"name":"USRS RETRO","starting_elo":1500,"k":k,"home_elo_edge":home_edge,"status":"provisional coefficients; historical calibration not completed"},
        "quality":quality,"teams":ordered,"games":allgames}
    tmp=output.with_suffix(".json.tmp");tmp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+"\n");tmp.replace(output)
    print(gender,json.dumps(quality),source_counts)
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--bootstrap",action="store_true")
    args=parser.parse_args()
    for gender in ("men","women"):update(gender,bootstrap=args.bootstrap)
if __name__=="__main__":main()

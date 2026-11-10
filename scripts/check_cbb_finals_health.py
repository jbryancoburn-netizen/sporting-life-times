#!/usr/bin/env python3
"""Independent CBB production guard: newly completed D-I games and public data."""
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

DATA=Path("data")
SITE="https://jbryancoburn-netizen.github.io/sporting-life-times/"
EASTERN=ZoneInfo("America/New_York")

def read(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SLT-CBB-Finals-Health/1.0",
                                           "Cache-Control":"no-cache","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=22) as response:
        return json.load(response)

def expected(gender,ids,now):
    sport="mens" if gender=="men" else "womens"
    base="https://site.api.espn.com/apis/site/v2/sports/basketball/"+sport+"-college-basketball/scoreboard"
    found={}
    for offset in range(3):
        day=(now.astimezone(EASTERN).date()-timedelta(days=offset)).strftime("%Y%m%d")
        successes=0
        for query in ("?limit=1000&dates="+day,"?groups=50&limit=1000&dates="+day):
            try:
                events=fetch(base+query).get("events")
                if not isinstance(events,list):raise ValueError("bad scoreboard payload")
                successes+=1
                for event in events:
                    if event.get("status",{}).get("type",{}).get("completed") is not True:continue
                    sides=(event.get("competitions") or [{}])[0].get("competitors") or []
                    home=next((s for s in sides if s.get("homeAway")=="home"),None)
                    away=next((s for s in sides if s.get("homeAway")=="away"),None)
                    if not home or not away:continue
                    home_id=str(home.get("team",{}).get("id") or "")
                    away_id=str(away.get("team",{}).get("id") or "")
                    if home_id not in ids or away_id not in ids or home_id==away_id:continue
                    try:
                        hs=int(home["score"]);ass=int(away["score"])
                        when=datetime.fromisoformat(event["date"].replace("Z","+00:00"))
                    except (KeyError,TypeError,ValueError):continue
                    if hs<1 or ass<1 or hs==ass:continue
                    eid=str(event.get("id",""))
                    if not eid.isdigit():continue
                    found[eid]=(home_id,away_id,hs,ass,when)
            except (OSError,ValueError,TypeError):
                continue
        if not successes:
            raise RuntimeError("Both ESPN scoreboard feeds failed for "+gender+" "+day)
    return found

def main():
    now=datetime.now(timezone.utc)
    cross=read(DATA/"ncaam-2026-27-espn-team-crosswalk.json")["teams"]
    men_map={str(t["espn_id"]):str(t["id"]) for t in cross if t.get("espn_id")}
    women_ids={str(x["team_id"]) for x in read(DATA/"ncaaw-2026-27-teams.json")["teams"]}
    result={}
    for gender,ids,rating_file in (
        ("men",set(men_map),"ncaam-2026-27-retro-primary.json"),
        ("women",women_ids,"ncaaw-2026-27-retro-primary.json"),
    ):
        ratings=read(DATA/rating_file)
        wanted_count=365 if gender=="men" else 363
        if ratings.get("starting_elo")!=1500 or len(ratings.get("rankings",[]))!=wanted_count:
            raise ValueError("Incomplete "+gender+" ratings")
        events=ratings.get("events") or []
        if len(events)!=ratings.get("games_played"):
            raise ValueError("RETRO replay count mismatch "+gender)
        game_ids={str(g.get("id","")).removeprefix("espn:") for g in events}
        fixtures=set()
        for g in events:
            fixtures.add((str(g.get("home_id")),str(g.get("away_id")),
                          int(g.get("home_score",0)),int(g.get("away_score",0))))
        published=fetch(SITE+"data/"+rating_file+"?health="+str(int(now.timestamp())))
        site_ok=(published.get("events")==events and
                 published.get("rankings")==ratings.get("rankings") and
                 published.get("as_of")==ratings.get("as_of"))
        scoreboard=expected(gender,ids,now)
        missing=[]
        for eid,(home,away,hs,ass,when) in scoreboard.items():
            pair=(men_map[home],men_map[away],hs,ass) if gender=="men" else (home,away,hs,ass)
            if eid not in game_ids and pair not in fixtures:
                missing.append({"id":eid,"home":home,"away":away,
                                "age_minutes":round((now-when).total_seconds()/60)})
        result[gender]={"scoreboard_finals":len(scoreboard),"ratings_finals":len(events),
                        "missing_finals":missing,"public_matches_repository":site_ok,
                        "as_of":ratings.get("as_of")}
    print(json.dumps(result,indent=2))
    outputs=os.environ.get("GITHUB_OUTPUT")
    if outputs:
        with open(outputs,"a",encoding="utf-8") as f:
            f.write("refresh_men="+str(bool(result["men"]["missing_finals"])).lower()+"\n")
            f.write("refresh_women="+str(bool(result["women"]["missing_finals"])).lower()+"\n")
            f.write("deploy="+str(any(not r["public_matches_repository"] for r in result.values())).lower()+"\n")
            f.write("stale="+str(any(any(x["age_minutes"]>=180 for x in r["missing_finals"]) or
                                  not r["public_matches_repository"] for r in result.values())).lower()+"\n")

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("CBB PRODUCTION HEALTH FAILED:",repr(exc),file=sys.stderr)
        sys.exit(1)

#!/usr/bin/env python3
"""Independent CBB production guard: newly completed D-I games and public data."""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from audit_cbb_final_pipeline import score

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

def final_key(game):
    sides = ((str(game["home_id"]), int(game["home_score"])),
             (str(game["away_id"]), int(game["away_score"])))
    return str(game["date"])[:10], tuple(sorted(sides))

def public_calendars(gender, scoreboard, public_data, now):
    """Check the actual team-page inputs for today's completed games."""
    today = now.astimezone(EASTERN).date()
    checks = {}
    for eid, (home, away, hs, ass, tip) in scoreboard.items():
        if tip.astimezone(EASTERN).date() != today:
            continue
        for school in (home, away):
            checks.setdefault(school, []).append((eid, {home: hs, away: ass}, tip))
    if not checks:
        return [], 0
    if gender == "women":
        schedules = public_data("ncaaw-schedules-2026-27.json")["teams"]
        quarantine = read(DATA / "wbb-final-calendar-reconciliation-audit.json")
        conflicts = {(str(c["game_id"]), str(c["team_id"]))
                     for c in quarantine.get("quarantined_schedule_conflicts", [])}
        missing = []
        for school, games in checks.items():
            rows = schedules.get(school, {}).get("games", [])
            finals = {str(row["id"]): {
                str(row["home_id"]): row.get("home_score"),
                str(row["away_id"]): row.get("away_score"),
            } for row in rows if row.get("completed") is True}
            for eid, scores, _ in games:
                if (eid, school) not in conflicts and finals.get(eid) != scores:
                    missing.append(f"{eid}/{school}")
        return missing, len(conflicts & {(eid, school) for school, games in checks.items()
                                         for eid, _, _ in games})

    def check_men(item):
        school, games = item
        rows = public_data(f"mbb-schedules-2026-27/{school}.json").get("events", [])
        finals = []
        for row in rows:
            if row.get("status", {}).get("type", {}).get("completed") is not True:
                continue
            sides = (row.get("competitions") or [{}])[0].get("competitors", [])
            scores = {str(side.get("team", {}).get("id")): score(side) for side in sides}
            finals.append((str(row.get("id", "")).removeprefix("espn:"), scores,
                           str(row.get("date", ""))[:10]))
        return [f"{eid}/{school}" for eid, scores, tip in games
                if not any(actual == scores and (key == eid or day in {
                    tip.date().isoformat(), tip.astimezone(EASTERN).date().isoformat(),
                }) for key, actual, day in finals)]

    with ThreadPoolExecutor(max_workers=12) as workers:
        return [missing for group in workers.map(check_men, checks.items()) for missing in group], 0

def main():
    now=datetime.now(timezone.utc)
    def public_data(path):
        return fetch(SITE + "data/" + path + "?health=" + str(int(now.timestamp())))

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
        fixtures = {final_key(g) for g in events}
        published = public_data(rating_file)
        public_events = published.get("events", [])
        public_fixtures = {final_key(g) for g in public_events}
        site_ok = (published.get("starting_elo") == 1500 and
                   len(published.get("rankings", [])) == wanted_count and
                   published.get("games_played") == len(public_events) and
                   fixtures <= public_fixtures and
                   (fixtures != public_fixtures or published.get("rankings") == ratings.get("rankings")))
        scoreboard=expected(gender,ids,now)
        missing=[]
        missing_public=[]
        calendar_games = {}
        for eid,(home,away,hs,ass,when) in scoreboard.items():
            h, a = (men_map[home], men_map[away]) if gender == "men" else (home, away)
            scores = tuple(sorted(((h, hs), (a, ass))))
            keys = {(day.isoformat(), scores) for day in (when.date(), when.astimezone(EASTERN).date())}
            if not keys & fixtures:
                missing.append(eid)
            if keys & public_fixtures:
                calendar_games[eid] = (home, away, hs, ass, when)
            else:
                missing_public.append(eid)
        calendar_missing, quarantined = public_calendars(gender, calendar_games, public_data, now)
        result[gender]={"scoreboard_finals":len(scoreboard),"ratings_finals":len(events),
                        "missing_finals":missing,"public_retro_covers_repository":site_ok,
                        "missing_public_finals":missing_public,
                        "missing_public_calendar_entries":calendar_missing,
                        "quarantined_calendar_entries":quarantined,
                        "as_of":ratings.get("as_of")}
    print(json.dumps(result,indent=2))
    outputs=os.environ.get("GITHUB_OUTPUT")
    if outputs:
        with open(outputs,"a",encoding="utf-8") as f:
            f.write("refresh_men="+str(bool(result["men"]["missing_finals"])).lower()+"\n")
            f.write("refresh_women="+str(bool(result["women"]["missing_finals"])).lower()+"\n")
            f.write("deploy="+str(any(not r["public_retro_covers_repository"] or
                                     r["missing_public_calendar_entries"] for r in result.values())).lower()+"\n")
            f.write("stale="+str(any(r["missing_public_finals"] or r["missing_public_calendar_entries"] or
                                    not r["public_retro_covers_repository"] for r in result.values())).lower()+"\n")

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("CBB PRODUCTION HEALTH FAILED:",repr(exc),file=sys.stderr)
        sys.exit(1)

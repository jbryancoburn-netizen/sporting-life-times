#!/usr/bin/env python3
"""Upcoming/live NBA games for the independent NBA newspaper.

Fetches the active and next seven Eastern calendar dates from ESPN scoreboards.
Schedules and live scores are attributed to ESPN, never invented. Completed games
remain in the separate final-score Elo and player-box repositories.
"""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/nba-upcoming-schedule.json"
ALIASES = {"NY":"NYK","GS":"GSW","SA":"SAS","NO":"NOP","UTAH":"UTA","WSH":"WAS"}
URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={}&limit=100"

def fetch_date(date):
    request = Request(URL.format(date), headers={"User-Agent":"Mozilla/5.0 SportingLifeTimes","Accept":"application/json"})
    with urlopen(request, timeout=18) as response:
        data = json.load(response)
    if not isinstance(data.get("events"), list):
        raise ValueError("NBA schedule response lacks events")
    return data["events"]

def parse_game(event):
    comp = (event.get("competitions") or [{}])[0]
    if int((event.get("season") or {}).get("type") or 0) != 2:
        return None
    contestants = comp.get("competitors") or []
    teams = []
    for side in ("away","home"):
        item = next((v for v in contestants if v.get("homeAway") == side), None)
        if item is None:
            return None
        team = item.get("team") or {}
        code = ALIASES.get(team.get("abbreviation"), team.get("abbreviation"))
        if not code:
            return None
        teams.append({
            "name":team.get("displayName") or team.get("name") or code,
            "code":code,
            "home_away":side,
            "score":int(item["score"]) if str(item.get("score","")).isdigit() else None,
        })
    state = ((event.get("status") or {}).get("type") or {}).get("state")
    if (event.get("status") or {}).get("type",{}).get("completed") is True:
        state = "post"
    if state not in ("pre","in","post"):
        return None
    return {
        "id":"espn-nba-"+str(event.get("id") or ""),
        "date":event.get("date"),
        "state":state,
        "status":((event.get("status") or {}).get("type") or {}).get("description") or state,
        "teams":teams,
        "url":"https://www.espn.com/nba/game/_/gameId/"+str(event.get("id")),
        "source":"ESPN NBA scoreboard",
    }

def main():
    # Use America/New_York for the NBA newspaper's displayed day.
    from zoneinfo import ZoneInfo
    now = datetime.now(timezone.utc)
    eastern_today = now.astimezone(ZoneInfo("America/New_York")).date()
    dates = [(eastern_today + timedelta(days=i)).strftime("%Y%m%d") for i in range(8)]
    data = {}
    failed_dates = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for date, result in zip(dates, pool.map(collect, dates)):
            if isinstance(result, Exception):
                failed_dates.append(date)
                print("Schedule endpoint failed", date, result)
            else:
                for event in result:
                    parsed = parse_game(event)
                    if parsed and parsed["id"] != "espn-nba-":
                        data[parsed["id"]] = parsed
    if not data:
        raise SystemExit("No verified NBA fixture responses: preserve prior published schedule")
    if failed_dates:
        raise SystemExit("Incomplete NBA schedule dates "+", ".join(failed_dates)+"; preserve prior feed")
    games = sorted(data.values(), key=lambda g:(g["date"] or "",g["id"]))
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({
        "updated_at":now.isoformat(),
        "source":"ESPN NBA dated scoreboards",
        "dates_checked":dates,
        "games":games,
    },indent=2,ensure_ascii=False)+"\n")
    print("Verified NBA schedule:",len(games),"games across",len(dates),"days")

def collect(date):
    try:
        return fetch_date(date)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        return exc

if __name__ == "__main__":
    main()

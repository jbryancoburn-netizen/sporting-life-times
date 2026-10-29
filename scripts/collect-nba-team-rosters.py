#!/usr/bin/env python3
"""Capture all 30 actual NBA team rosters, never inferring membership from box scores."""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data/nba-team-rosters-2026-27.json"
TEAM_IDS = {
    "ATL": 1, "BOS": 2, "BKN": 17, "CHA": 30, "CHI": 4, "CLE": 5,
    "DAL": 6, "DEN": 7, "DET": 8, "GSW": 9, "HOU": 10, "IND": 11,
    "LAC": 12, "LAL": 13, "MEM": 29, "MIA": 14, "MIL": 15,
    "MIN": 16, "NOP": 3, "NYK": 18, "OKC": 25, "ORL": 19,
    "PHI": 20, "PHX": 21, "POR": 22, "SAC": 23, "SAS": 24,
    "TOR": 28, "UTA": 26, "WAS": 27,
}
SOURCE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/roster"

def collect(code, team_id):
    url = SOURCE.format(id=team_id)
    request = Request(url, headers={"User-Agent": "SportingLifeTimes/1.0 (public score and roster research)", "Accept": "application/json"})
    with urlopen(request, timeout=20) as response:
        data = json.load(response)
    if data.get("season", {}).get("year") not in (None, 2027):
        raise ValueError(f"{code}: expected 2026-27 roster")
    athletes = data.get("athletes")
    if not isinstance(athletes, list):
        raise ValueError(f"{code}: missing athlete list")
    if athletes and isinstance(athletes[0], dict) and "items" in athletes[0]:
        athletes = [p for group in athletes for p in group.get("items", [])]
    roster, seen = [], set()
    for p in athletes:
        if not isinstance(p, dict):
            continue
        pid = str(p.get("id") or "")
        name = p.get("displayName") or p.get("fullName")
        if not pid.isdigit() or not name or pid in seen:
            continue
        seen.add(pid)
        injury_items = p.get("injuries") or []
        injury = injury_items[0] if injury_items and isinstance(injury_items[0], dict) else {}
        player = {
            "id": pid, "name": name, "jersey": str(p.get("jersey") or ""),
            "position": (p.get("position") or {}).get("abbreviation") or "—",
            "position_name": (p.get("position") or {}).get("displayName") or "",
            "height": p.get("displayHeight") or "",
            "weight": p.get("displayWeight") or "",
            "age": p.get("age"),
            "experience": (p.get("experience") or {}).get("years"),
            "status": (p.get("status") or {}).get("name") or "",
            "injury": injury.get("status") or injury.get("type") or "",
            "headshot": (p.get("headshot") or {}).get("href") or "",
        }
        roster.append(player)
    if not 10 <= len(roster) <= 35:
        raise ValueError(f"{code}: suspicious roster size {len(roster)}")
    roster.sort(key=lambda p: ({"PG":0, "SG":1, "G":2, "SF":3, "PF":4, "F":5, "C":6}.get(p["position"], 7), p["name"]))
    return {"source": url, "updated_at": datetime.now(timezone.utc).isoformat(), "players": roster}

def main():
    existing = json.loads(DEST.read_text()) if DEST.exists() else {}
    teams = dict(existing.get("teams") or {})
    failures, refreshed = {}, []
    with ThreadPoolExecutor(max_workers=6) as executor:
        future_map = {executor.submit(collect, code, team_id): code for code, team_id in TEAM_IDS.items()}
        for future in as_completed(future_map):
            code = future_map[future]
            try:
                teams[code] = future.result()
                refreshed.append(code)
            except Exception as error:
                failures[code] = str(error)[:180]
    missing = sorted(set(TEAM_IDS) - set(teams))
    now = datetime.now(timezone.utc).isoformat()
    output = {
        "league": "NBA", "season": "2026-27",
        "updated_at": now, "source": "ESPN current NBA team rosters",
        "teams": {code: teams[code] for code in TEAM_IDS if code in teams},
        "fresh_teams": sorted(refreshed),
        "stale_teams": sorted(set(TEAM_IDS) - set(refreshed)),
        "errors": failures,
        "missing_teams": missing,
    }
    if not refreshed:
        raise RuntimeError("No NBA team roster endpoints succeeded; old data preserved")
    if missing:
        raise RuntimeError("Incomplete initial 30-team NBA roster collection: " + ", ".join(missing) + "; " + str(failures))
    DEST.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"NBA rosters: 30 teams, {sum(len(x['players']) for x in output['teams'].values())} players, {len(refreshed)} refreshed, {len(output['stale_teams'])} previous snapshots retained")
    if output["stale_teams"]:
        print("WARN stale teams:", ", ".join(output["stale_teams"]))

if __name__ == "__main__":
    main()

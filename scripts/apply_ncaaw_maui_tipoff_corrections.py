#!/usr/bin/env python3
"""Apply tournament-organizer-confirmed 2026 Maui Classic tipoffs to both team schedules.

Run after the normal women's schedule ingestion step, before publishing.
Only changes two exact game IDs; safe to rerun.
"""
import json
from pathlib import Path

SOURCE = "https://verticalsportsmaui.com/maui-classic/"
PATH = Path("data/ncaaw-schedules-2026-27.json")
TIMES = {"401928314": "2026-12-19T03:00Z", "401928315": "2026-12-20T03:00Z"}

def main():
    data = json.loads(PATH.read_text(encoding="utf-8"))
    seen = {game_id: set() for game_id in TIMES}
    changed = 0
    for team_id, team in data["teams"].items():
        for game in team.get("games", []):
            game_id = str(game.get("id", ""))
            if game_id not in TIMES:
                continue
            if team_id in seen[game_id]:
                raise ValueError(f"Duplicate game {game_id} for team {team_id}")
            seen[game_id].add(team_id)
            if game.get("date") != TIMES[game_id]:
                game["date"] = TIMES[game_id]
                changed += 1
            game["official_tipoff_source_type"] = "official_tournament_organizer"
            game["official_tipoff_source_url"] = SOURCE
            game["official_tipoff_local"] = "5:00 PM HST"
            game["official_tipoff_verified"] = True
    if any(len(ids) != 2 for ids in seen.values()):
        raise ValueError(f"Expected both team records for both Maui games, found {seen}")
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(seen)} game IDs in 4 team records; changed {changed} UTC times.")

if __name__ == "__main__":
    main()

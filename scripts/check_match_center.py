#!/usr/bin/env python3
"""Check the published Match Center snapshot without inventing missing coverage."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
scoreboards = json.loads((ROOT / "scoreboards.json").read_text(encoding="utf-8"))
details = json.loads((ROOT / "match_details.json").read_text(encoding="utf-8"))
assert isinstance(details.get("games"), dict), "Missing game detail map"
assert isinstance(details.get("coverage"), dict), "Missing league coverage diagnostics"
assert isinstance(details.get("updated_at"), str), "Missing detail publication timestamp"
assert isinstance(scoreboards.get("leagues"), list), "Missing scoreboard leagues"
indexed = {str(league.get("league")) + "::" + str(game.get("id"))
           for league in scoreboards["leagues"] for game in league.get("games", [])}
bad = []
for key, game in details["games"].items():
    if not isinstance(game, dict) or not isinstance(game.get("events"), list) or not isinstance(game.get("statistics"), list):
        bad.append(key)
    assert isinstance(game.get("players", []), list), f"Malformed players collection: {key}"
    for player in game.get("players", []):
        assert isinstance(player, dict), f"Malformed player: {key}"
        assert isinstance(player.get("stats"), list), f"Malformed player stats: {key}"
        assert isinstance(player.get("labels", []), list), f"Malformed player labels: {key}"
        assert len(player.get("stats", [])) <= 40, f"Unexpected player statistic width: {key}"
    if not isinstance(game.get("fetched_at"), str):
        bad.append(key)
assert not bad, "Malformed detail records: " + ", ".join(bad[:5])
for league, row in details["coverage"].items():
    for field in ("attempted", "available", "failed", "cached"):
        assert isinstance(row.get(field), int) and row[field] >= 0, f"Invalid {league}.{field}"
    assert row["available"] + row["failed"] == row["attempted"] + row["cached"], f"Inconsistent coverage for {league}"
    assert row["with_events"] <= row["available"], f"Event coverage exceeds available: {league}"
    assert row["with_statistics"] <= row["available"], f"Statistic coverage exceeds available: {league}"
print("MATCH CENTER DATA HEALTH")
print("Scoreboard games:", len(indexed))
print("Detail records (including archive):", len(details["games"]))
print("Current games with details:", len(indexed.intersection(details["games"])))
print("Games with player statistics:", sum(bool(g.get("players")) for g in details["games"].values()))
print("Games with team statistics:", sum(bool(g.get("statistics")) for g in details["games"].values()))
print("Games with events:", sum(bool(g.get("events")) for g in details["games"].values()))
print("Provider errors:", len(details.get("errors", [])))
for league, row in sorted(details["coverage"].items()):
    print(f"{league}: {row['available']}/{row['attempted']} available; {row['cached']} cached; {row['failed']} failed; {row.get('with_events',0)} with events; {row.get('with_statistics',0)} with team stats")

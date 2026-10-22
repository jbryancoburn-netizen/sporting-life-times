#!/usr/bin/env python3
"""Check the published Match Center snapshot without inventing missing coverage."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
scoreboards = json.loads((ROOT / "scoreboards.json").read_text(encoding="utf-8"))
details = json.loads((ROOT / "match_details.json").read_text(encoding="utf-8"))
assert isinstance(details.get("games"), dict), "Missing game detail map"
archive_path = ROOT / "data" / "match_center_archive.json"
assert archive_path.is_file(), "Collector did not create Match Center archive snapshot"
archive = json.loads(archive_path.read_text(encoding="utf-8"))
assert isinstance(archive.get("games"), dict), "Invalid archive game map"
assert archive["games"] == details.get("games"), "Archive and published game details disagree"
assert len(archive["games"]) <= 1500, "Archive exceeds configured size limit"

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
    metadata = game.get("game")
    if metadata is not None:
        assert isinstance(metadata, dict) and isinstance(metadata.get("teams"), list) and len(metadata["teams"]) == 2, f"Malformed archived game identity: {key}"
    for event in game.get("events", []):
        assert isinstance(event, dict) and isinstance(event.get("text"), str), f"Malformed event: {key}"
        if "scoring" in event:
            assert isinstance(event["scoring"], bool), f"Invalid scoring flag: {key}"
    for total in game.get("team_totals", []):
        assert isinstance(total, dict) and isinstance(total.get("stats"), list) and isinstance(total.get("labels"), list), f"Malformed team total: {key}"
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
index_path = ROOT / "match_archive_index.json"
assert index_path.is_file(), "Historical game index missing"
historical = json.loads(index_path.read_text(encoding="utf-8"))
assert isinstance(historical.get("games"), list), "Historical index must contain games"
index_keys = [r.get("key") for r in historical["games"]]
assert len(index_keys) == len(set(index_keys)), "Historical index contains duplicate game keys"
for item in historical["games"]:
    assert isinstance(item.get("source"), str) and item["source"], "Historical index missing source"
    assert isinstance(item.get("teams"), list) and len(item["teams"]) == 2, "Historical index missing teams"
    assert item["source"] == "match_details.json" or (ROOT / item["source"]).is_file(), "Historical shard missing"

print("MATCH CENTER DATA HEALTH")
print("Historical indexed games:", len(index_keys))
print("Scoreboard games:", len(indexed))
print("Detail records (including archive):", len(details["games"]))
print("Archive snapshot matches published detail records:", True)
print("Current games with details:", len(indexed.intersection(details["games"])))
print("Games with player statistics:", sum(bool(g.get("players")) for g in details["games"].values()))
print("Games with team statistics:", sum(bool(g.get("statistics")) for g in details["games"].values()))
print("Games with events:", sum(bool(g.get("events")) for g in details["games"].values()))
print("Provider errors:", len(details.get("errors", [])))
print("Archived games with navigable metadata:", sum(isinstance(g.get("game"), dict) and len(g["game"].get("teams") or []) == 2 for g in details["games"].values()))
for league, row in sorted(details["coverage"].items()):
    print(f"{league}: {row['available']}/{row['attempted']} available; {row['cached']} cached; {row['failed']} failed; {row.get('with_events',0)} with events; {row.get('with_statistics',0)} with team stats")

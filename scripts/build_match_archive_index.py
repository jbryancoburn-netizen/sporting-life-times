#!/usr/bin/env python3
"""Generate a compact, source-backed index for on-demand historical games."""
import json
from pathlib import Path


def build_index(active, shards):
    rows = {}
    def add(games, source):
        for key, record in games.items():
            if not isinstance(record, dict):
                continue
            game = record.get("game")
            if not isinstance(game, dict) or not game.get("id") or not game.get("league"):
                continue
            teams = game.get("teams")
            if not isinstance(teams, list) or len(teams) != 2:
                continue
            if key in rows and source != "match_details.json":
                continue
            rows[key] = {"key": key, "id": str(game["id"]), "league": game["league"],
                         "date": game.get("date"), "name": game.get("name"),
                         "teams": [t.get("name", "") if isinstance(t, dict) else "" for t in teams],
                         "source": source}
    add(active.get("games") or {}, "match_details.json")
    for source, games in shards:
        if not isinstance(games, dict):
            raise ValueError("Malformed historical shard: " + source)
        add(games, source)
    return {"updated_at": active.get("updated_at"), "games": sorted(rows.values(), key=lambda r: (str(r["date"] or ""), r["key"]), reverse=True)}


if __name__ == "__main__":
    ROOT = Path(__file__).resolve().parents[1]
    active = json.loads((ROOT / "match_details.json").read_text(encoding="utf-8"))
    shards = [(p.relative_to(ROOT).as_posix(), json.loads(p.read_text(encoding="utf-8")))
              for p in sorted((ROOT / "data" / "match_archive_shards").glob("*.json"))]
    index = build_index(active, shards)
    (ROOT / "match_archive_index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Historical game index:", len(index["games"]), "navigable records")

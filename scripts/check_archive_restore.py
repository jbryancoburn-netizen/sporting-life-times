#!/usr/bin/env python3
"""Diagnose whether the prior Match Center archive was restored."""
import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "data" / "match_center_archive.json"
if not path.exists():
    print("MATCH CENTER ARCHIVE RESTORE: no cached archive; published-site recovery will be attempted")
else:
    archive = json.loads(path.read_text(encoding="utf-8"))
    games = archive.get("games")
    if not isinstance(games, dict):
        raise SystemExit("MATCH CENTER ARCHIVE RESTORE: invalid game map")
    print("MATCH CENTER ARCHIVE RESTORE:", len(games), "previous game records")
    print("Prior archive update:", archive.get("updated_at", "unknown"))

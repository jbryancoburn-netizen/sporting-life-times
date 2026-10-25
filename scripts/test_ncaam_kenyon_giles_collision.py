#!/usr/bin/env python3
"""Reject the UMass Lowell/Wichita State same-name NCAA athlete collision."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
case=json.loads((root/"ncaam-2026-27-kenyon-giles-identity-collision.json").read_text())
reviews=json.loads((root/"ncaam-2026-27-unlinked-transfer-final-16-review.json").read_text())
assert case["current_espn_id"]=="5457833"
assert case["status"].startswith("NAME_COLLISION_CONFIRMED")
assert case["current_player_evidence"]["hometown"] != case["conflicting_player_evidence"]["hometown"]
assert case["release_action"]=="REJECT_WICHITA_STATE_NAME_MATCH_KEEP_SOURCE_SCHOOL_UNVERIFIED"
assert case["published_elo_changed"] is False
record=next(x for x in reviews["cases"] if x["espn_athlete_id"]==case["current_espn_id"])
assert record["classification"]=="unresolved_source_school"
assert record["production_historical_minutes_authorized"] is False
print("PASS: distinct Kenyon Giles records, no Wichita State statistics attributed to UMass Lowell")

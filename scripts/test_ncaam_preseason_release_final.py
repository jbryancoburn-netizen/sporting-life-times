#!/usr/bin/env python3
"""Fail closed if the NCAA 2026-27 provisional release drifts or silently promotes research."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
read=lambda name:json.loads((root/name).read_text())
d=read("ncaam-2026-27-preseason-final-release-decision.json")
m=read("ncaam-2026-27-preseason-roster-informed.json")
triage=read("ncaam-2026-27-player-identity-triage.json")
overlap=read("ncaam-2026-27-corroborated-player-overlap-audit.json")
reviews=read("ncaam-2026-27-unlinked-transfer-final-16-review.json")
corrections=read("ncaam-2026-27-unlinked-official-corrections-batch-01.json")
assert d["selected_publication"]=="data/ncaam-2026-27-preseason-roster-informed.json"
assert d["decision"]=="RELEASE_PROVISIONAL_COMPLETE_FIELD_KEEP_EXPERIMENTS_SEPARATE"
assert m["team_count"]==len(m["rankings"])==365 and m["games_played"]==0
assert len({x["team_id"] for x in m["rankings"]})==365
assert sorted(x["rank"] for x in m["rankings"])==list(range(1,366))
for row in m["rankings"]:
    assert math.isfinite(row["elo"]) and math.isfinite(row["base_elo"]) and math.isfinite(row["offseason_adjustment"])
    assert abs(row["elo"]-(row["base_elo"]+row["offseason_adjustment"]))<.002
    assert row["season_games"]==0
assert triage["total_roster_players"]==5537
assert triage["numbers"]["accepted_prior_production"]==2923
assert overlap["new_historical_id_links"]==0
assert len(corrections["records"])==10 and len(reviews["cases"])==16
assert all(x["production_historical_minutes_authorized"] is False for x in reviews["cases"])
assert reviews["changed_primary_elo"] is False and corrections["published_elo_changed"] is False
assert d["quality_gate"]["fully_certified"] is False
print("PASS: NCAA 2026-27 operational provisional preseason release is complete, 365 unique ordered model-consistent ratings; historical research remains gated")

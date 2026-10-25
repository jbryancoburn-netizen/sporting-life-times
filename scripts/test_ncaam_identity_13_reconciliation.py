#!/usr/bin/env python3
"""Check all thirteen flagged NCAA athlete cases against official-source evidence."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
load=lambda name:json.loads((root/"data"/name).read_text())
triage=load("ncaam-2026-27-player-identity-triage.json")
out=load("ncaam-2026-27-identity-13-evidence-reconciliation.json")
batches=[load(f"ncaam-2026-27-official-identity-evidence-batch-0{i}.json") for i in (1,2,3)]
sources={str(c["current_player_id"]):c for b in batches for c in b["cases"]}
flagged={str(c["current_player_id"]):c for c in triage["flagged_cases"]}
assert len(sources)==len(flagged)==len(out["cases"])==13
for row in out["cases"]:
    ident=row["current_player_id"]
    assert ident in sources and ident in flagged
    assert row["official_status"]==sources[ident]["evidence_status"]
    assert row["official_sources"]==sources[ident]["official_sources"]
    assert row["production_action"]==sources[ident]["production_action"]
    assert row["historical_player_id"]==flagged[ident]["historical_player_id"]
    assert row["release_action"]=="EXCLUDE_PENDING_DOCUMENTARY_VERIFICATION"
assert not out["publication_ratings_changed"]
assert out["accepted_prior_minutes_from_flagged_cases"]==0
print("PASS: all thirteen flagged NCAA player histories remain excluded with institutional evidence")

#!/usr/bin/env python3
"""Verify immutable NCAA historical capture ledger independently from network replay."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
ledger=json.loads((root/"ncaam-confirmed-pregame-archive-captures.json").read_text())
audit=json.loads((root/"ncaam-preseason-roster-source-provenance.json").read_text())
assert ledger["primary_elo_promotion_authorized"] is False
assert ledger["full_365_team_snapshot_verified"] is False
entries=ledger["verified_captures"]
assert len(entries)>=3
seen=set()
for e in entries:
    key=(e["team"],e["season_end_year"],e["archived_capture_utc"])
    assert key not in seen
    seen.add(key)
    assert re.fullmatch(r"20[0-9]{12}",e["archived_capture_utc"])
    assert re.fullmatch("[a-f0-9]{64}",e["captured_content_sha256"])
    assert e["capture_url"].startswith("https://web.archive.org/web/"+e["archived_capture_utc"]+"id_/https://")
    assert len(set(e["matched_player_evidence"]))>=2
# A later replay can be unavailable without erasing a historically verified capture.
current=[r.get("wayback_index",r) for r in audit["sources"]+audit["season_page_wayback_checks"]]
for r in current:
    if not r.get("independently_verified_preopening_roster_content"):continue
    key=(r["team"],r["season_end_year"],r["verified_capture_utc"])
    assert key in seen,"Current newly verified evidence must first be added to ledger: "+str(key)
    e=next(x for x in entries if (x["team"],x["season_end_year"],x["archived_capture_utc"])==key)
    assert e["captured_content_sha256"]==r["captured_content_sha256"]
assert audit["summary"]["dataset_complete_for_2024_2025_training_2026_holdout"] is False
print(f"PASS: {len(entries)} permanent historical capture proofs; {audit['summary']['confirmed_archived_pregame_content_sources']} confirmed by latest replay, preseason approval blocked")

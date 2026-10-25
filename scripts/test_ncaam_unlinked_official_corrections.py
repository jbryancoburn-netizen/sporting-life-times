#!/usr/bin/env python3
"""Validate official-school corrections of false NCAA D-I history candidates."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
read=lambda x:json.loads((root/x).read_text())
queue=read("ncaam-2026-27-unlinked-2014-recovery-queue.json")
corrections=read("ncaam-2026-27-unlinked-official-corrections-batch-01.json")
current={x["espn_athlete_id"]:x for x in queue["players"]}
assert len(queue["players"])==2014
assert corrections["reviews"]==len(corrections["records"])==3
assert {p["espn_athlete_id"] for p in corrections["records"]}=={"5142733","5456911","5462487"}
for case in corrections["records"]:
    p=current[case["espn_athlete_id"]]
    assert p["player"]==case["player"] and p["current_team"]==case["team"]
    assert p["source_candidate_status"]=="unique-name-transfer-candidate"
    assert p["statistical_join_approved"] is False
    assert case["source_url"].startswith("https://")
    assert case["action"].startswith("REJECT_FALSE_")
assert corrections["published_elo_changed"] is False
print("PASS: three source-documented false transfer candidates excluded; source candidate classes left auditable")

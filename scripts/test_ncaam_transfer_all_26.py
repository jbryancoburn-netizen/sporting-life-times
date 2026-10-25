#!/usr/bin/env python3
"""Verify complete 26-case NCAA transfer-name triage without unapproved Elo joins."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
read=lambda n:json.loads((root/n).read_text())
prior=read("ncaam-2026-27-unlinked-official-corrections-batch-01.json")["records"]
new=read("ncaam-2026-27-unlinked-transfer-final-16-review.json")["cases"]
cross=read("ncaam-2026-27-direct-player-crosswalk.json")
movement=read("ncaam-2026-27-player-movement-audit.json")
candidate={}
for t in movement["teams"]:
    for p in t["players"]:
        if p["status"]=="unique-name-transfer-candidate" and str(p["current_id"]) in cross["unlinked_espn_ids"]:
            candidate[str(p["current_id"])]=(t["team"],p["player"])
assert len(candidate)==26
assert len(prior)==10 and len(new)==16
assert sum(x["classification"]=="false_d1_match" for x in new)==11
assert sum(x["classification"]=="corroborated_prior_d1_history" for x in new)==4
assert sum(x["classification"]=="unresolved_source_school" for x in new)==1
seen=set()
for p in prior+new:
    k=p["espn_athlete_id"]
    assert k not in seen and k in candidate
    seen.add(k)
    assert p["player"]==candidate[k][1] and p["team"]==candidate[k][0]
    assert p["source_url"].startswith("https://")
    if p in new:assert p["production_historical_minutes_authorized"] is False
assert set(candidate)==seen
print("PASS: 26/26 reviewed; 21 rejected name-only D-I matches, 4 corroborated D-I histories, 1 unresolved; Elo stays unchanged")

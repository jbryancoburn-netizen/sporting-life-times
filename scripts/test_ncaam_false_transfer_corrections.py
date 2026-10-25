#!/usr/bin/env python3
"""Prevent name-only 2025-26 statistics for documented 2026-27 NCAA newcomers."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
read=lambda s:json.loads((root/s).read_text())
cases=read("ncaam-2026-27-unlinked-official-corrections-batch-01.json")
queue=read("ncaam-2026-27-unlinked-2014-recovery-queue.json")
index={p["espn_athlete_id"]:p for p in queue["players"]}
assert cases["reviews"]==10 and len(cases["records"])==10
assert not cases["published_elo_changed"] and cases["statistical_records_removed_from_published_elo"]==0
seen=set()
for p in cases["records"]:
    k=p["espn_athlete_id"]
    assert k not in seen and k in index
    seen.add(k)
    candidate=index[k]
    assert candidate["player"]==p["player"] and candidate["current_team"]==p["team"]
    assert candidate["source_candidate_status"]=="unique-name-transfer-candidate"
    assert not candidate["statistical_join_approved"]
    assert p["source_url"].startswith("https://")
    assert p["action"].startswith("REJECT_FALSE_")
print("PASS: ten official-source mismatches rejected; no unsupported player minutes or Elo mutations")

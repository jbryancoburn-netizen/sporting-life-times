#!/usr/bin/env python3
"""Revalidate all 2,014 previously unlinked NCAA player cases without guessing identities."""
import json
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]/"data"
read=lambda p: json.loads((ROOT/p).read_text())
movement=read("ncaam-2026-27-player-movement-audit.json")
crosswalk=read("ncaam-2026-27-direct-player-crosswalk.json")
official=read("ncaam-2026-27-official-player-origin-overlay.json")
corrob=read("ncaam-2026-27-official-prior-school-corroborations.json")
queue=read("ncaam-2026-27-unlinked-2014-recovery-queue.json")
people={}
for t in movement["teams"]:
    for p in t["players"]:
        k=str(p["current_id"])
        assert k not in people
        people[k]=(t,p)
assert len(people)==5537
ids={str(x) for x in crosswalk["unlinked_espn_ids"]}
assert len(ids)==2014
assert not ids.intersection(str(p["id"]) for p in crosswalk["links"])
old={str(p["espn_athlete_id"]):p for p in official["records"]}
docs={str(p["current_espn_id"]):p for p in corrob["records"]}
assert len(queue["players"])==2014
assert {p["espn_athlete_id"] for p in queue["players"]}==ids
counts=Counter()
for q in queue["players"]:
    k=q["espn_athlete_id"]
    team,p=people[k]
    assert q["player"]==p["player"] and q["current_team_id"]==team["team_id"]
    assert q["source_candidate_status"]==p["status"]
    assert q["candidate_prior_school_id"]==p.get("prior_school_id")
    assert q["statistical_join_approved"] is False
    if k in old:
        assert q["official_origin"]==old[k]["origin"]
    if k in docs:
        assert q["official_historical_correlated_id"]==docs[k]["historical_ncaa_athlete_id"]
    counts[q["source_candidate_status"]]+=1
assert dict(counts)==queue["candidate_counts"]
assert counts=={"no-prior-d1-box":1984,"unique-name-transfer-candidate":26,"id-not-found-name-ambiguous":4}
assert sum(bool(p["official_historical_correlated_id"]) for p in queue["players"])==4
assert sum(p["official_origin"]=="new-to-d1" for p in queue["players"])==4
assert queue["ratings_changed"] is False
print("PASS: 2,014 unlinked players reconciled; 26 transfer candidates prioritized; four corroborated historical links kept provisional")

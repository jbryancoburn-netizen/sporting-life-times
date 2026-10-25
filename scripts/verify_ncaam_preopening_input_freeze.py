#!/usr/bin/env python3
"""Audit the pinned 2026-27 preopening CBB inputs and exact v1 arithmetic.

Git-captured does not mean all university rosters were officially validated;
nor is this a retrospective preseason predictive validation.
"""
import json, math, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/"data/ncaam-2026-27-preopening-input-freeze.json").read_text())
def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
def load_pinned(path):
    return json.loads(subprocess.check_output(
        ["git","show",m["baseline_commit"]+":"+path],cwd=ROOT,text=True))
assert m["season"]=="2026-27"
assert m["evidence_classification"]=="GIT_VERSIONED_SOURCE_FREEZE_NOT_OFFICIAL_SCHOOL_ROSTER_ASOF_VERIFICATION"
for f in m["frozen_blob_refs"]:
    found=git("rev-parse",m["baseline_commit"]+":"+f["path"])
    assert found==f["git_blob_sha"], f["path"]+": frozen blob mismatch"
movement=load_pinned("data/ncaam-2026-27-player-movement-audit.json")
base=load_pinned("data/ncaam-2026-27-preseason-provisional.json")
shadow=load_pinned("data/ncaam-2026-27-player-value-experimental-v1.json")
assert movement["players_audited"]==m["population"]["current_roster_player_records"]==5537
assert shadow["coverage"]==m["population"]["experimental_linked_histories"]==2923
assert shadow["team_count"]==m["population"]["teams"]==365
assert shadow["beta_elo_per_ppm"]==m["research_coefficient_elo_per_point_per_minute"]==300
assert shadow["production_elo_approved"] is False
b={r["team_id"]:r for r in base["rankings"]}
rows=shadow["rankings"]
assert len(b)==len(rows)==365 and len({r["team_id"] for r in rows})==365
for i,r in enumerate(rows):
    assert r["team_id"] in b
    assert r["rank"]==i+1 and (i==0 or rows[i-1]["elo"]>=r["elo"])
    assert abs(r["baseline_elo"]-b[r["team_id"]]["elo"])<0.00001
    assert abs(r["elo"]-r["baseline_elo"]-r["experimental_quality_adjustment"])<0.00022
    assert abs(r["experimental_quality_adjustment"]-300*(r["player_quality_index"]-shadow["team_quality_center"]))<0.001
    assert abs(r["projected_verified_minutes"]+r["unmodeled_minutes"]-200)<0.021
    assert all(math.isfinite(float(r[x])) for x in ("elo","baseline_elo","player_quality_index"))
print("PASS: pinned Git source blobs, 5,537 roster players, 2,923 linked histories, 365 exact experimental formula rows")
print("NOT CERTIFIED: official current preseason roster provenance and historical preopening holdout still missing")

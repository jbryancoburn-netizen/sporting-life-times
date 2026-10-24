#!/usr/bin/env python3
"""Verify 365-team experimental NCAA player value ratings and release boundaries."""
import json,math
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
shadow=json.loads((d/"ncaam-2026-27-player-value-experimental-v1.json").read_text())
baseline=json.loads((d/"ncaam-2026-27-preseason-provisional.json").read_text())
rows=shadow["rankings"]; b={x["team_id"]:x for x in baseline["rankings"]}
assert shadow["status"]=="SHADOW_ONLY_NOT_BACKTESTED" and shadow["production_elo_approved"] is False
assert shadow["team_count"]==365 and shadow["games_played"]==0
assert len(rows)==len(b)==365 and len(set(x["team_id"] for x in rows))==365
for i,r in enumerate(rows):
    assert r["rank"]==i+1
    assert i==0 or rows[i-1]["elo"]>=r["elo"]
    assert math.isfinite(r["elo"]) and math.isfinite(r["experimental_quality_adjustment"])
    assert abs(r["baseline_elo"]-b[r["team_id"]]["elo"])<.00001
    assert abs(r["elo"]-r["baseline_elo"]-r["experimental_quality_adjustment"])<.00021
    assert 0<=r["projected_verified_minutes"]<=200.0001
    assert 0<=r["unmodeled_minutes"]<=200.0001
    assert abs(r["projected_verified_minutes"]+r["unmodeled_minutes"]-200)<.02
    assert r["verified_players"]==r["returners"]+r["transfers"]
assert shadow["coverage"]==2923
high=next(x for x in rows if x["team"]=="High Point")
assert high["verified_players"]==12 and high["returners"]==4 and high["transfers"]==8
print(f"PASS: player-value shadow {len(rows)} teams, High Point rank {high['rank']}, no primary promotion")

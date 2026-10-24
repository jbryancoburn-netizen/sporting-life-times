#!/usr/bin/env python3
"""Validate 2026-27 player-level scoring records against the frozen 365-team shadow."""
import json, math
from collections import defaultdict
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
p=json.loads((d/"ncaam-2026-27-individual-player-values.json").read_text())
model=json.loads((d/"ncaam-2026-27-player-value-experimental-v1.json").read_text())
rows=p["players"]; groups=defaultdict(list)
assert len(rows)==p["current_roster_players"]==5537
assert len({x["current_player_id"] for x in rows})==5537
assert p["production_elo_approved"] is False
assert p["measured_prior_d1_players"]==2923
for row in rows:
    groups[row["team_id"]].append(row)
    if row["score_status"]=="NO_VERIFIED_HISTORICAL_VALUE":
        assert row["historical_ppm"] is None and row["shrunk_ppm"] is None
        assert row["player_elo_contribution"] is None and row["projected_mpg"]==0
    else:
        assert row["score_status"]=="MEASURED_HISTORICAL_SCORING_SHRUNK"
        assert row["historical_minutes"]>0 and row["historical_games"]>0
        assert math.isfinite(row["shrunk_ppm"]) and row["projected_mpg"]>=0
        assert row["role"] in ("returner","transfer")
assert len(groups)==365
for team in model["rankings"]:
    people=groups[team["team_id"]]
    good=[x for x in people if x["score_status"]=="MEASURED_HISTORICAL_SCORING_SHRUNK"]
    assert len(good)==team["verified_players"],team["team"]
    minutes=sum(x["projected_mpg"] for x in people)
    assert minutes<=200.001,team["team"]
    assert abs(minutes-team["projected_verified_minutes"])<0.02,team["team"]
    index=sum(x["player_elo_contribution"] for x in good)/p["elo_per_ppm"]
    assert abs(index-team["player_quality_index"])<0.00002,team["team"]
assert p["unverified_players"]==5537-2923
print("PASS: all 5537 player records, 2923 measured histories, 365 team aggregates")

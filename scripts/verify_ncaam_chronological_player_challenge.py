#!/usr/bin/env python3
"""Check the 2026-27 CBB player-value challenge against saved dated holdout evidence."""
import json
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
load=lambda name:json.loads((d/name).read_text())
r=load("ncaam-2026-27-player-quality-validated-challenge.json")
h=load("ncaam-quality-earlyseason-asof-backtest.json")
decision=load("ncaam-2026-27-player-quality-release-decision.json")
release=load("ncaam-2026-27-preseason-final-release-decision.json")
x=r["earlyseason_asof"]
a,b=h["holdout_minutes"],h["holdout_quality"]
assert h["status"]=="CHRONOLOGICALLY_VALID_EARLYSEASON_NOT_PRESEASON"
assert h["asof_current_roster_verified"] is True
assert h["preseason_release_approved"] is False
assert x["games"]==a["games"]==b["games"]>=1000
assert x["training_seasons"]==h["training_seasons"]==[2024,2025]
assert x["holdout_season"]==h["holdout_season"]==2026
assert x["selected_quality_beta"]==h["selected_quality_beta"]
assert all(abs(x[k]-v)<1e-12 for k,v in {
    "baseline_log_loss":a["log_loss"],"candidate_log_loss":b["log_loss"],
    "baseline_brier":a["brier"],"candidate_brier":b["brier"],
    "log_loss_gain":a["log_loss"]-b["log_loss"],
    "brier_gain":a["brier"]-b["brier"]}.items())
assert x["log_loss_gain"]>0 and x["brier_gain"]>0
assert all(e["postcutoff_box_rows_excluded"]>1000 for e in h["asof_player_evidence"].values())
assert r["production_policy"]["automatic_primary_promotion"] is False
assert decision["player_quality_model_approved_for_primary"] is False
assert release["quality_gate"]["fully_certified"] is False
print("PASS: 1596-game strictly post-day-14 historical holdout supports shadow feature, not preseason promotion")

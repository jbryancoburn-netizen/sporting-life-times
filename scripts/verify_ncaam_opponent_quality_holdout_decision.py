#!/usr/bin/env python3
"""Verify published opponent-quality holdout decision against measured game samples."""
import json
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
x=json.loads((d/"ncaam-opponent-quality-backtest.json").read_text())
q=json.loads((d/"ncaam-2026-27-opponent-quality-holdout-decision.json").read_text())
a,b=x["holdout_baseline"],x["holdout_adjusted"]
p,c=x["holdout_all_games_game_only"],x["holdout_all_games_enhanced_with_fallback"]
assert q["production_elo_approved"] is False
assert q["preseason_roster_asof_verified"] is False
assert a["games"]==b["games"]==q["matched_holdout_games"]==1658
assert a["matched_games_sha256"]==b["matched_games_sha256"]
assert p["games"]==c["games"]==q["full_holdout_games"]==1831
assert p["matched_games_sha256"]==c["matched_games_sha256"]
assert a["log_loss"]>b["log_loss"] and a["brier"]>b["brier"]
assert p["log_loss"]>c["log_loss"] and p["brier"]>c["brier"]
assert abs(q["matched_incremental_gain_log_loss"]-(a["log_loss"]-b["log_loss"]))<1e-12
assert abs(q["matched_incremental_gain_brier"]-(a["brier"]-b["brier"]))<1e-12
assert q["selected_opponent_strength_beta"]==x["training_winner"]["beta_per_100_opponent_elo"]
print("PASS: opponent-quality 2026 holdout report accurately recorded; preseason promotion withheld")

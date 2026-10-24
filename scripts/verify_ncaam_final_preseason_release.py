#!/usr/bin/env python3
"""Fail publication when NCAA release decision contradicts 365-team evidence."""
import json,math
from pathlib import Path
d=Path(__file__).resolve().parents[1]/"data"
m=json.loads((d/"ncaam-2026-27-preseason-final-release-decision.json").read_text())
r=json.loads((d/"ncaam-2026-27-preseason-roster-informed.json").read_text())
v=json.loads((d/"ncaam-2026-27-player-value-experimental-v1.json").read_text())
h=json.loads((d/"ncaam-opponent-quality-backtest.json").read_text())
rows=r["rankings"]
assert m["selected_publication"]=="data/ncaam-2026-27-preseason-roster-informed.json"
assert m["selected_model"]==r["model"] and m["selected_model_status"]==r["status"]
assert m["ranked_teams"]==len(rows)==365 and len({x["team_id"] for x in rows})==365
assert all(x["rank"]==i for i,x in enumerate(rows,1))
assert all(i==0 or rows[i-1]["elo"]>=x["elo"] for i,x in enumerate(rows))
assert all(math.isfinite(x["elo"]) and abs(x["elo"]-x["base_elo"]-x["offseason_adjustment"])<.00021 for x in rows)
assert m["games_played"]==r["games_played"]==0
assert len(v["rankings"])==365 and v["production_elo_approved"] is False
assert m["quality_gate"]["fully_certified"] is False
assert m["measured_holdout"]["matched_games"]==h["holdout_baseline"]["games"]
assert h["holdout_baseline"]["matched_games_sha256"]==h["holdout_adjusted"]["matched_games_sha256"]
assert h["holdout_adjusted"]["log_loss"]<h["holdout_baseline"]["log_loss"]
assert h["holdout_adjusted"]["brier"]<h["holdout_baseline"]["brier"]
assert m["measured_holdout"]["not_direct_validation_of_current_player_value_v1"] is True
print("PASS: complete 365-team NCAA provisional preseason release; experimental promotion blocked")

#!/usr/bin/env python3
"""Lock NCAA Elo champion/challenger decision to actual comparable evidence."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
read=lambda name:json.loads((root/name).read_text())
release=read("ncaam-2026-27-preseason-final-release-decision.json")
champion=read("ncaam-2026-27-preseason-roster-informed.json")
challenger=read("ncaam-2026-27-player-value-experimental-v1.json")
holdout=read("ncaam-offseason-transfer-backtest.json")
assert release["selected_publication"]=="data/ncaam-2026-27-preseason-roster-informed.json"
assert release["selected_model"]==champion["model"]
assert champion["team_count"]==challenger["team_count"]==365
assert {r["team_id"] for r in champion["rankings"]}=={r["team_id"] for r in challenger["rankings"]}
assert challenger["production_elo_approved"] is False
assert challenger["status"]=="SHADOW_ONLY_NOT_BACKTESTED"
assert release["measured_holdout"]["not_direct_validation_of_current_player_value_v1"] is True
assert holdout["test_candidate"]["games"]==holdout["test_baseline"]["games"]
assert holdout["test_candidate"]["log_loss"]<holdout["test_baseline"]["log_loss"]
assert holdout["test_candidate"]["brier"]<holdout["test_baseline"]["brier"]
assert holdout["shrinkage_challenge"]["promote_to_primary"] is False
assert release["quality_gate"]["fully_certified"] is False
print("PASS: current 365-team roster-informed Elo remains champion; player-value v1 shadow-only")
print("PASS: 2026 roster-retention holdout improves baseline but does not validate separate player-value v1")

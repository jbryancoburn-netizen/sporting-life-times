#!/usr/bin/env python3
"""Audit genuine preseason promotion evidence without granting approval.

A historical match is useful only if its roster membership was known before
the game. An improved retrospective holdout cannot bypass that requirement.
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data"
read=lambda name:json.loads((root/name).read_text())
release=read("ncaam-2026-27-preseason-final-release-decision.json")
provenance=read("ncaam-preseason-roster-source-provenance.json")
backtest=read("ncaam-opponent-quality-backtest.json")
holdout=read("ncaam-2026-27-opponent-quality-holdout-decision.json")
summary=provenance["summary"]
assert summary["fully_verified_365_team_preseason_roster_snapshots"] <= 365
assert summary["dataset_complete_for_2024_2025_training_2026_holdout"] is False or summary["fully_verified_365_team_preseason_roster_snapshots"] == 365
assert holdout["matched_holdout_games"]==backtest["holdout_baseline"]["games"]==backtest["holdout_adjusted"]["games"]
assert backtest["holdout_baseline"]["matched_games_sha256"]==backtest["holdout_adjusted"]["matched_games_sha256"]
assert holdout["preseason_roster_asof_verified"]==summary["dataset_complete_for_2024_2025_training_2026_holdout"]
assert release["quality_gate"]["historical_preopening_roster_membership_validated"]==summary["dataset_complete_for_2024_2025_training_2026_holdout"]
assert release["quality_gate"]["fully_certified"] is False or all(v for k,v in release["quality_gate"].items() if k!="fully_certified")
assert not (holdout["production_elo_approved"] and not holdout["preseason_roster_asof_verified"]), "Retrospective leakage risk: promotion without frozen pregame rosters"
assert not (release["quality_gate"]["fully_certified"] and not holdout["production_elo_approved"]), "Elo certified despite unapproved opponent adjustment"
print("PASS: pre-opening source-provenance and same-game holdout gates consistent")
print(f"Verified preseason season-team snapshots: {summary['fully_verified_365_team_preseason_roster_snapshots']}")
print(f"Strict holdout contests: {holdout['matched_holdout_games']}")
print(f"Strict pre-opening source coverage complete: {summary['dataset_complete_for_2024_2025_training_2026_holdout']}")
print(f"Model fully certified: {release['quality_gate']['fully_certified']}")

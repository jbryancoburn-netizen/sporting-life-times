#!/usr/bin/env python3
"""Fail if scoring features are promoted without chronologically valid holdout evidence."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"

def verify(scoring, preseason, legacy, decision):
    if scoring.get("season") != "2026-27" or len(scoring.get("teams", [])) != 365:
        raise ValueError("Incomplete scoring shadow")
    counts = scoring["source_counts"]
    if counts["matched_scoring_records"] != sum(t["verified_players"] for t in scoring["teams"]):
        raise ValueError("Player evidence counts differ")
    if len({t["team_id"] for t in scoring["teams"]}) != 365:
        raise ValueError("Duplicated scoring teams")
    if {t["team_id"] for t in scoring["teams"]} != {t["team_id"] for t in preseason["rankings"]}:
        raise ValueError("Player quality team IDs differ from published Elo")
    if decision["player_quality_model_approved_for_primary"]:
        h = decision.get("player_quality_holdout", {})
        if not (h.get("chronological_train_test_separation") is True and
                h.get("source_roster_asof_times_verified") is True and
                h.get("games", 0) > 0 and
                h.get("baseline_log_loss", 0) > h.get("candidate_log_loss", 1) and
                h.get("baseline_brier", 0) > h.get("candidate_brier", 1)):
            raise ValueError("Unverified player quality model marked approved")
    if decision["player_quality_model_approved_for_primary"] is False:
        if preseason.get("production_elo_approved") is not False:
            raise ValueError("Preseason rating prematurely marked approved")
    if legacy.get("approved_for_primary") is True and decision["player_quality_holdout"]["games"] == 0:
        raise ValueError("Legacy promotion unexpectedly approved")
    return True

def main():
    names = ["ncaam-2026-27-player-scoring-shadow.json",
             "ncaam-2026-27-preseason-roster-informed.json",
             "ncaam-offseason-transfer-backtest.json",
             "ncaam-2026-27-player-quality-release-decision.json"]
    verify(*(json.loads((ROOT / n).read_text()) for n in names))
    print("PASS: scoring evidence reconciles and unvalidated quality model remains shadow-only")

if __name__ == "__main__":
    main()

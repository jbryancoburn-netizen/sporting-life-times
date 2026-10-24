#!/usr/bin/env python3
"""Reproducible release decision for NCAA player-quality preseason challenger.

Math checks alone cannot establish predictive quality. A holdout of exact,
pre-opening, time-stamped historical roster snapshots with identical player
features is mandatory before production Elo is replaced.
"""
import json
from pathlib import Path

def audit(overhaul,incumbent,provenance,quality_decision,calibration=None,scoring_shadow=None):
    rows=overhaul.get("rankings",[])
    incumbent_rows=incumbent.get("rankings",[])
    reasons=[]
    if len(rows)!=365 or len(incumbent_rows)!=365 or len({x["team_id"] for x in rows})!=365:
        reasons.append("TEAM_COVERAGE_UNVERIFIED")
    if any(x.get("rank")!=i for i,x in enumerate(rows,1)):
        reasons.append("RANK_ORDER_INVALID")
    if any(abs(x["elo"]-x["base_elo"]-x["offseason_adjustment"])>.00021 for x in rows):
        reasons.append("ELO_ARITHMETIC_INVALID")
    if calibration is not None and scoring_shadow is not None:
        beta=calibration.get("selected_quality_beta")
        if (overhaul.get("source_quality_beta")!=beta or
            scoring_shadow.get("source_integrity",{}).get("quality_beta")!=beta):
            reasons.append("STALE_OR_MISMATCHED_PLAYER_QUALITY_CALIBRATION")
        if (calibration.get("status")!="CHRONOLOGICALLY_VALID_EARLYSEASON_NOT_PRESEASON" or
            calibration.get("preseason_release_approved") is not False or
            calibration.get("holdout_both_improved") is not True):
            reasons.append("EARLYSEASON_RESEARCH_CALIBRATION_INVALID")
    if overhaul.get("identity_mismatches"):
        reasons.append("PLAYER_IDENTITY_COUNTS_NOT_FULLY_RECONCILED")
    if not provenance.get("summary",{}).get("dataset_complete_for_2024_2025_training_2026_holdout",False):
        reasons.append("HISTORICAL_PREGAME_ROSTER_SNAPSHOTS_INCOMPLETE")
    if not quality_decision.get("player_quality_model_approved_for_primary",False):
        reasons.append("CURRENT_PLAYER_FEATURE_VALIDATION_NOT_APPROVED")
    if not overhaul.get("exact_same_games_holdout_both_improved",False):
        reasons.append("EXACT_SAME_GAME_PRESEASON_HOLDOUT_IMPROVEMENT_UNPROVEN")
    if not overhaul.get("preseason_asof_certified",False):
        reasons.append("ASOF_SEASON_OPENING_FEATURES_UNCERTIFIED")
    return {"season":"2026-27","candidate_model":overhaul.get("model"),
       "production_model":incumbent.get("model"),
       "decision":"PROMOTE" if not reasons else "RETAIN_INCUMBENT_UNTIL_VALIDATED",
       "promotion_approved":not reasons,"blocking_reasons":reasons,
       "team_count":len(rows),
       "identity_discrepancies":overhaul.get("identity_mismatches",[]),
       "evidence_policy":"No ratings promoted for plausibility or poll resemblance; strict preseason as-of feature-identical same-game holdout must beat incumbent on both log loss and Brier."}

def main():
    root=Path("data")
    read=lambda n:json.loads((root/n).read_text())
    result=audit(read("ncaam-2026-27-player-quality-overhaul-shadow.json"),
      read("ncaam-2026-27-preseason-roster-informed.json"),
      read("ncaam-preseason-roster-source-provenance.json"),
      read("ncaam-2026-27-player-quality-release-decision.json"),
      read("ncaam-quality-earlyseason-asof-backtest.json"),
      read("ncaam-2026-27-scoring-quality-shadow.json"))
    output=root/"ncaam-2026-27-overhaul-promotion-audit.json"
    output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""Accuracy-first promotion gate for NCAA Elo challengers.

Never promote based on rank aesthetics, coefficient magnitude, or model complexity.
The signed-off production claim requires an as-of valid, feature-identical,
chronologically held-out improvement over the strongest incumbent.
"""
import argparse
import json
from pathlib import Path

def decision(report):
    baseline=report["holdout_minutes_only"]
    challenger=report["holdout_minutes_plus_quality"]
    reasons=[]
    if baseline["games"]!=challenger["games"] or baseline["games"]<=0:
        reasons.append("HOLDOUT_GAME_COUNT_MISMATCH")
    if report.get("train_seasons")!=[2024,2025] or report.get("untouched_holdout_season")!=2026:
        reasons.append("TRAIN_HOLDOUT_SPLIT_NOT_CERTIFIED")
    for field in ("log_loss","brier"):
        if not challenger[field]<baseline[field]:
            reasons.append("NO_HELDOUT_"+field.upper()+"_GAIN")
    if report.get("training_grid_boundary"):
        reasons.append("BEST_COEFFICIENT_ON_SEARCH_BOUNDARY")
    if not report.get("preseason_asof_certified",False):
        reasons.append("HISTORICAL_ROSTER_NOT_VERIFIED_AS_OF_PRESEASON")
    if not report.get("current_feature_formula_equal_to_historical",False):
        reasons.append("CURRENT_HISTORICAL_FEATURE_EQUIVALENCE_UNVERIFIED")
    return {"promotion_approved":not reasons,"reasons":reasons,
            "selection_rule":"Train on 2024-25, evaluate once on untouched 2026; require identical games, both metrics lower, as-of data and exact matching features; never cap adjustments to make rankings look reasonable",
            "coefficient":report.get("features",{}).get("selected_quality_beta"),
            "holdout_games":challenger["games"],
            "logloss_gain":baseline["log_loss"]-challenger["log_loss"],
            "brier_gain":baseline["brier"]-challenger["brier"]}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--report",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    d=decision(json.loads(Path(args.report).read_text()))
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(d,indent=2)+"\n")
    print(json.dumps(d,indent=2))
if __name__=="__main__":main()

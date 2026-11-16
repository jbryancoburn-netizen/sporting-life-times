#!/usr/bin/env python3
"""Read-only RETRO MAE laboratory. No live rating or forecast is modified.

Uses only frozen forecasts and scored finals in the existing audit report.
Every correction for date D uses results with dates strictly before D.
Fixed challenger settings are hypotheses, not parameters fit on test dates.
"""
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "retro-spread-accuracy-2026-27.json"

def mae(values):
    return sum(values) / len(values) if values else None

def evaluate(report, holdout_days=5):
    games = report.get("games", [])
    if not games:
        raise ValueError("No scored immutable forecasts")
    seen = set()
    by_day = defaultdict(list)
    for row in games:
        key = (row["date"], row["id"])
        if key in seen:
            raise ValueError("Duplicate scored game: " + str(key))
        seen.add(key)
        if row["home_id"] == row["away_id"]:
            raise ValueError("Invalid duplicate opponent: " + str(key))
        pred = float(row["predicted_home_margin"])
        actual = float(row["actual_home_margin"])
        if abs(abs(actual-pred)-float(row["absolute_margin_error"])) > 0.00011:
            raise ValueError("Inconsistent recorded absolute error: " + str(key))
        by_day[row["date"]].append(row)
    dates = sorted(by_day)
    if len(dates) <= holdout_days:
        raise ValueError("Insufficient dates to establish training and holdout")
    split = len(dates)-holdout_days
    # Both fixed challengers are evaluated without selection on the holdout.
    candidates = {"original": 0.0, "prior_bias_quarter": 0.25,
                  "prior_bias_half": 0.5, "prior_bias_full": 1.0}
    errors = {key: [] for key in candidates}
    test_by_day = {}
    for day in dates[split:]:
        history = [r for d in dates if d < day for r in by_day[d]]
        if not history:
            raise ValueError("Holdout day lacks historical training games")
        bias = sum(float(r["actual_home_margin"])-float(r["predicted_home_margin"])
                   for r in history)/len(history)
        day_errors = {key: [] for key in candidates}
        for row in by_day[day]:
            pred = float(row["predicted_home_margin"])
            actual = float(row["actual_home_margin"])
            for key, weight in candidates.items():
                e = abs(actual - (pred + weight*bias))
                errors[key].append(e)
                day_errors[key].append(e)
        test_by_day[day] = {"games": len(by_day[day]),
                            "prior_games": len(history),
                            "prior_mean_signed_error": round(bias, 5),
                            "mae": {k: round(mae(v), 4) for k,v in day_errors.items()}}
    baseline = mae(errors["original"])
    scores = {k: {"mae": round(mae(v), 5),
                  "delta_mae_vs_original": round(mae(v)-baseline, 5)}
              for k,v in candidates.items()}
    # Deliberately do not auto-promote even when the shadow improves.
    return {
        "status": "SHADOW_ONLY_NOT_PROMOTED",
        "model": "retro-mae-prior-date-bias-shadow-v1",
        "sport": report.get("sport"),
        "season": report.get("season"),
        "audit_snapshot_sha256": hashlib.sha256(
            json.dumps(report, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "total_scored_games": len(games),
        "total_scored_dates": len(dates),
        "holdout_dates": dates[split:],
        "holdout_games": sum(len(by_day[d]) for d in dates[split:]),
        "candidate_parameters_fixed_before_holdout": candidates,
        "heldout_scores": scores,
        "heldout_by_date": test_by_day,
        "overall_original_mae": round(mae([float(r["absolute_margin_error"]) for r in games]), 5),
        "overall_signed_home_margin_error": round(
            mae([float(r["actual_home_margin"])-float(r["predicted_home_margin"]) for r in games]), 5),
        "missing_capture_timestamp_scored": sum(not r.get("captured_at_utc") for r in games),
        "orientation_excluded_ids": report.get("excluded_orientation_mismatches", []),
        "limitations": [
            "Hypothesis check on a short early-season sample; not a confirmed production gain.",
            "Rolling history includes previous holdout days strictly after those games finish.",
            "No retrospective reconstruction of Elo states, possession data, or verified venue identities.",
            "No selection or automatic publication of a winning challenger.",
            "Women's data must be separately audited and trained; no transfer of men's coefficients."
        ]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT)
    parser.add_argument("--holdout-days", type=int, default=5)
    parser.add_argument("--output", type=Path, help="Optional shadow JSON output")
    args = parser.parse_args()
    if args.holdout_days < 1:
        parser.error("--holdout-days must be positive")
    report = json.loads(args.input.read_text(encoding="utf-8"))
    result = evaluate(report, args.holdout_days)
    serialized = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")

if __name__ == "__main__":
    main()

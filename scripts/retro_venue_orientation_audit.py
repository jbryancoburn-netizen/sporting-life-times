#!/usr/bin/env python3
"""Audit RETRO venue and orientation consistency without changing source records.

Compare archived pregame site labels with final-ledger site flags. A final's
neutral=True is *not* treated as conclusive neutral-site proof: these systems
may assign different meanings to that flag. Every disagreement stays flagged
for independent evidence reconciliation, not automatic reassignment.
"""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))

def audit(archive, report, finals):
    predictions = archive["predictions"]
    scored = report["games"]
    source_events = finals["events"]
    def indexed(rows):
        mapping = {}
        for row in rows:
            key = (row["date"], row["id"])
            if key in mapping:
                raise ValueError(f"Duplicate game/date identity: {key}")
            mapping[key] = row
        return mapping
    predictions_by_key = indexed(predictions)
    finals_by_key = indexed(source_events)
    scored_by_key = indexed(scored)
    counts = defaultdict(lambda: {"games": 0, "total_error": 0., "total_signed_error": 0.})
    conflicts = []
    reversed_orientation = []
    other_identity_mismatch = []
    for key, p in predictions_by_key.items():
        f = finals_by_key.get(key)
        if not f:
            continue
        if (p.get("home_id"), p.get("away_id")) != (f.get("home_id"), f.get("away_id")):
            row = {"date": key[0], "id": key[1],
                   "forecast_home_id": p.get("home_id"), "forecast_away_id": p.get("away_id"),
                   "final_home_id": f.get("home_id"), "final_away_id": f.get("away_id")}
            if (p.get("home_id"), p.get("away_id")) == (f.get("away_id"), f.get("home_id")):
                reversed_orientation.append(row)
            else:
                other_identity_mismatch.append(row)
            continue
        g = scored_by_key.get(key)
        if not g:
            continue
        venue = p.get("venue_verification") or "missing"
        final_flag = ("neutral_true" if f.get("neutral") is True else
                      "neutral_false" if f.get("neutral") is False else "neutral_unknown")
        site_flag = "site_verified" if f.get("site_verified") is True else "site_unverified"
        category = "|".join([venue, final_flag, site_flag])
        obj = counts[category]
        obj["games"] += 1
        obj["total_error"] += abs(float(g["actual_home_margin"])-float(g["predicted_home_margin"]))
        obj["total_signed_error"] += float(g["actual_home_margin"])-float(g["predicted_home_margin"])
        if venue == "verified_home" and f.get("neutral") is True:
            conflicts.append({"date": key[0], "id": key[1],
                              "reason": "verified_home_forecast_vs_final_neutral_true",
                              "final_site_verified": f.get("site_verified") is True})
    listed = set(report.get("excluded_orientation_mismatches", []))
    found = {r["id"] for r in reversed_orientation+other_identity_mismatch}
    if listed != found:
        raise ValueError("Final identity mismatch register does not match computed mismatches")
    metrics = {label: {"games": obj["games"],
                        "mae": round(obj["total_error"]/obj["games"], 4),
                        "signed_home_error": round(obj["total_signed_error"]/obj["games"], 4)}
               for label, obj in sorted(counts.items())}
    return {
        "status": "DIAGNOSTIC_ONLY_NO_ORIENTATION_OR_VENUE_REWRITES",
        "season": report["season"], "sport": report["sport"],
        "archived_predictions": len(predictions), "scored_games": len(scored),
        "forecast_venue_labels": dict(sorted(Counter(p.get("venue_verification") or "missing" for p in predictions).items())),
        "error_by_forecast_and_final_site_label": metrics,
        "potential_venue_label_conflicts": conflicts,
        "potential_venue_label_conflict_count": len(conflicts),
        "reversed_home_away_exclusions": reversed_orientation,
        "other_identity_exclusions": other_identity_mismatch,
        "limitations": [
            "Final event neutral=true may mean unknown or default, not proven neutral venue.",
            "Classification discrepancies are not proof of incorrect home advantage.",
            "Neither archive orientations nor prior forecasts are rewritten.",
            "Reconcile exact dated game, opponent, arena and provenance before revising any site.",
            "All MAE comparisons are descriptive; confounding and opponent strength remain."
        ]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit(load("retro-pregame-archive-2026-27.json"),
                   load("retro-spread-accuracy-2026-27.json"),
                   load("ncaam-2026-27-retro-primary.json"))
    txt = json.dumps(result, indent=2, sort_keys=True)+"\n"
    if args.output:
        args.output.write_text(txt, encoding="utf-8")
    print(txt, end="")

if __name__ == "__main__":
    main()

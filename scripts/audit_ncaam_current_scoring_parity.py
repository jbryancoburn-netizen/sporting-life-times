#!/usr/bin/env python3
"""Recompute the 2026-27 scoring-reference mismatch against held-out historical study.

An equal league reference is necessary but NOT sufficient for feature parity:
retrospective NCAA exact-name matching differs from current ESPN/NCAA identity crosswalk.
"""
import argparse
import json
from pathlib import Path

BASE=Path("data")
def load(filename,root=BASE):
    return json.loads((root/filename).read_text(encoding="utf-8"))

def audit(root=BASE):
    history=load("ncaam-exact-scoring-formula-retrospective-backtest.json",root)
    scoring=load("ncaam-2026-27-player-scoring-shadow.json",root)
    minutes=load("ncaam-2026-27-minutes-retention-audit.json",root)
    shadow=load("ncaam-2026-27-transfer-player-scoring-residual-challenge.json",root)
    original=history["roster_audit"]["2026"]["league_prior_points_per_minute"]
    current=shadow["league_scoring_reference"]
    coefficient=history["features"]["selected_quality_beta"]
    by_id={t["team_id"]:t for t in minutes["teams"]}
    changes=[]
    excluded=[]
    for t in scoring["teams"]:
        previous=by_id.get(t["team_id"])
        if not previous or not previous.get("prior_minutes",0)>0:
            excluded.append(t["team"])
            continue
        played=float(t["returning_prior_minutes"])+float(t["incoming_prior_minutes"])
        difference=coefficient*(current-original)*played/float(previous["prior_minutes"])
        changes.append({"team":t["team"],"team_id":t["team_id"],
                        "elo_difference_from_reference_only":round(difference,4)})
    if not changes: raise ValueError("No verified matching NCAA schools")
    values=[abs(t["elo_difference_from_reference_only"]) for t in changes]
    changes.sort(key=lambda t:-abs(t["elo_difference_from_reference_only"]))
    return {
        "status":"FORMULA_PARITY_FAILED_NOT_PRODUCTION_APPROVED",
        "historical_reference_ppm":original,
        "shadow_reference_ppm":current,
        "historical_selected_beta":coefficient,
        "matched_team_count":len(changes),
        "unmatched_teams":excluded,
        "mean_absolute_reference_only_elo_difference":round(sum(values)/len(values),6),
        "max_absolute_reference_only_elo_difference":round(max(values),4),
        "largest_reference_only_changes":changes[:20],
        "same_source_identity_rule":False,
        "same_scoring_reference":abs(current-original)<1e-12,
        "historical_roster_preseason_asof_certified":False,
        "production_approval":False,
        "explanation":"Reference-only delta excludes identity-link, roster-time and median-centering discrepancies; retrospective data do not prove a preseason-valid performance improvement."
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="data/ncaam-2026-27-scoring-parity-reproducible.json")
    args=parser.parse_args()
    result=audit()
    output=Path(args.output)
    output.parent.mkdir(exist_ok=True,parents=True)
    output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:result[k] for k in ("status","matched_team_count","mean_absolute_reference_only_elo_difference","max_absolute_reference_only_elo_difference")},indent=2))
if __name__=="__main__":main()

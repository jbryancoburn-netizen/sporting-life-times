#!/usr/bin/env python3
"""Diagnose boundary selection and realized player-stat Elo adjustments.

Research only. The selected grid maximum is not a calibrated physical bound.
"""
import json
from pathlib import Path
from statistics import median
from calibrate_ncaam_independent_stat_weights import FEATURES

def percentile(values,p):
    vals=sorted(values)
    if not vals:return None
    return vals[round((len(vals)-1)*p)]
def diagnose(report,features_by_year):
    weights=report["selected_weights"]
    results={}
    for year,teams in sorted(features_by_year.items()):
        total=[];each={k:[] for k in FEATURES}
        for team,parts in teams.items():
            contributions={k:weights[k]*parts.get(k,0.) for k in FEATURES}
            total.append(sum(contributions.values()))
            for k in FEATURES:each[k].append(contributions[k])
        results[str(year)]={
          "covered_teams":len(total),
          "total_adjustment_elo_points":{"min":min(total),"median":median(total),
            "p05":percentile(total,.05),"p95":percentile(total,.95),"max":max(total)},
          "per_stat_p95_absolute_elo_points":{k:percentile([abs(v) for v in vals],.95)
            for k,vals in each.items()}
        }
    return {"status":"RESEARCH_ONLY","coefficient_grid_upper_limit":600,
      "selected_coefficients":weights,
      "coefficients_on_upper_boundary":[k for k,v in weights.items() if v==600],
      "coefficient_boundary_is_arbitrary_search_limit":True,
      "source_preseason_snapshot_verified":False,
      "actual_stat_elo_effects":results,
      "production_promotion_allowed":False,
      "purpose":"Evaluate whether grid-edge coefficient causes outsized practical Elo adjustments"}

if __name__=="__main__":
    from calibrate_ncaam_independent_stat_weights import data
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument("--source",type=Path,required=True)
    ap.add_argument("--out",type=Path,default=Path("historical-report/ncaam-stat-coefficient-impact.json"))
    args=ap.parse_args()
    report=json.loads(Path("data/ncaam-independent-stat-weights.json").read_text())
    games,features,origin,multi=data(args.source)
    result=diagnose(report,multi)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))

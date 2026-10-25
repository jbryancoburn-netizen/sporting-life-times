#!/usr/bin/env python3
"""Continuous coordinate optimization of retrospective NCAA player-stat coefficients.

Train exclusively on 2024 games. Evaluate fixed solution on 2025 and the
previously inspected 2026 diagnostic. Both rosters and fixed other model
coefficients have acknowledged historical leakage risks. Never promote.
"""
import argparse,json,math
from pathlib import Path
from calibrate_ncaam_independent_stat_weights import data,score,FEATURES

def optimize(games,feats,origins,multi):
    cache={}
    def evaluate(weights):
        key=tuple(round(max(0.,v),5) for v in weights)
        if key not in cache:cache[key]=score(games,feats,origins,multi,key)
        return cache[key][2024]["log_loss"]
    # Unbounded nonnegative parameter domain; expansion is diagnostic,
    # not an assertion that any fixed value is the valid maximum.
    starts=((0.,0.,0.),(300.,600.,450.))
    runs=[]
    for start in starts:
        x=list(start);step=400.;trace=[]
        for iteration in range(28):
            old=evaluate(x)
            for k in range(3):
                proposals=[]
                for delta in (-step,-step/2,0.,step/2,step):
                    z=x.copy();z[k]=max(0.,x[k]+delta)
                    proposals.append((evaluate(z),sum(z),z))
                x=min(proposals,key=lambda t:(t[0],t[1]))[2]
            new=evaluate(x)
            trace.append({"iteration":iteration,"step":step,"train_log_loss":new,"weights":dict(zip(FEATURES,x))})
            if old-new<0.000002:step/=2
            if step<2.:break
        runs.append({"weights":x,"train_log_loss":evaluate(x),"iterations":len(trace),"trace":trace})
    chosen=min(runs,key=lambda a:(a["train_log_loss"],sum(a["weights"])))
    result=score(games,feats,origins,multi,chosen["weights"])
    previous=score(games,feats,origins,multi,(300.,600.,450.))
    return {"model":"ncaam-continuous-coordinate-player-stat-v1",
      "status":"RETROSPECTIVE_ONLY_NOT_PRESEASON_CERTIFIED",
      "optimizer":"nonnegative coordinate descent with adaptive step and two starts",
      "optimizer_converged_to_global_minimum":False,
      "search_has_arbitrary_upper_coefficient_cap":False,
      "train_year":2024,"validation_year":2025,"reused_diagnostic_year":2026,
      "selected_weights":dict(zip(FEATURES,chosen["weights"])),
      "training_log_loss":chosen["train_log_loss"],
      "validation_2025":result[2025],
      "prior_grid_validation_2025":previous[2025],
      "reused_2026":result[2026],
      "prior_grid_reused_2026":previous[2026],
      "two_initializations":runs,
      "evaluation_cache_count":len(cache),
      "production_promotion_allowed":False,
      "limitations":["Historical rosters not verified as-of the season opener",
        "2025 was inspected in earlier experiments; not untouched",
        "2026 was inspected repeatedly; diagnostic only",
        "Existing quality, transfer, churn and venue assumptions are fixed and not independently certified",
        "Coordinate descent convergence is not global-optimum proof"]}
def main():
    p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
    p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-continuous-stat-optimizer.json"))
    a=p.parse_args();r=optimize(*data(a.source))
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(r,indent=2)+"\n")
    print(json.dumps({k:v for k,v in r.items() if k!="two_initializations"},indent=2))
if __name__=="__main__":main()

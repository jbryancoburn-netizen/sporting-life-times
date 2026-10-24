#!/usr/bin/env python3
"""Predeclared compact NBL Elo parameter screen: earlier-year validation ONLY.
2026-27 is a single untouched evaluation, never used to choose settings.
Any model failing the held-out 50/50 baseline is blocked from publication.
"""
import argparse,json,math
from pathlib import Path
from scripts.nbl_three_season_eval import games,evaluate
GRID={"k":[12,20,32],"home_advantage_elo":[25,65,90],"regression":[.15,.35,.55]}
def loss(predictions,season):
    return predictions[season]["log_loss"]
def select(data):
    seasons=list(data.items())
    rows=[]
    for k in GRID["k"]:
        for home in GRID["home_advantage_elo"]:
            for reg in GRID["regression"]:
                preds=evaluate(seasons,k,home,reg)
                rows.append({"k":k,"home_advantage_elo":home,"regression":reg,
                             "validation_log_loss":loss(preds,"2025-26")})
    rows.sort(key=lambda x:(x["validation_log_loss"],x["k"],x["home_advantage_elo"],x["regression"]))
    selected=rows[0]
    fixed=evaluate(seasons,selected["k"],selected["home_advantage_elo"],selected["regression"])
    incumbent=evaluate(seasons,20.,65.,.25)
    out={"status":"RESEARCH_UNCERTIFIED","production_approved":False,
         "selection":"2025-26 validation log loss; 2026-27 not used to choose hyperparameters",
         "grid":GRID,"searched_models":len(rows),
         "selected_from_validation":selected,
         "selected_holdout":fixed["2026-27"],
         "incumbent_holdout":incumbent["2026-27"],
         "baseline_coinflip":{"log_loss":round(math.log(2),6),"brier":.25},
         "passes_holdout_log_loss":fixed["2026-27"]["log_loss"]<math.log(2),
         "validation_leaderboard":rows,
         "limitations":["Small validation sample; even 27 predeclared parameter combinations can overfit",
            "2026-27 holdout results cannot be used to select a new model",
            "All game results remain source candidates, not independently certified",
            "Opening equal-strength prior and offseason turnover require further evaluation"]}
    return out

def main():
    parser=argparse.ArgumentParser()
    for season in ("2024","2025","2026"):parser.add_argument("--s"+season,required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    d={s:games(getattr(args,"s"+s[:4]),s)[0] for s in ("2024-25","2025-26","2026-27")}
    result=select(d)
    target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:result[k] for k in ("selection","searched_models","selected_from_validation",
                     "selected_holdout","incumbent_holdout","passes_holdout_log_loss","production_approved")},indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""Chronological research-only coordinate calibration of player box components.

Select using 2024 season, validate fixed selection on 2025, and show the
previously inspected 2026 season only as repeated diagnostic. No promotion.
"""
import argparse,json
from pathlib import Path
from itertools import product
from backtest_ncaam_combined_elo import trial
from backtest_ncaam_quality_retrospective import read_gz,extract_games,school_key,preseason_features,unadjusted_end
from audit_ncaam_historical_transfer_origin import origin_features
from build_ncaam_historical_multistat_features import multistat_features

FEATURES=("shooting","playmaking","defense")
WEIGHTS=(0.,150.,300.,450.,600.)
def data(root):
 games={};feats={};origins={};multi={};prev_ratings={}
 for y in (2023,2024,2025,2026):
  roster=read_gz(root,"team_rosters",y)
  schools={school_key(r["team"]):str(r["team_id"]) for r in roster}
  games[y],_=extract_games(read_gz(root,"schedule",y),schools,read_gz(root,"player_box",y))
  if len(games[y])<3000:raise ValueError("Insufficient real games")
  if y>=2024:
   old=read_gz(root,"player_box",y-1)
   feats[y],_,_=preseason_features(roster,old)
   source,_=origin_features(roster,old,prev_ratings)
   origins[y]={r["destination"]:r["prior_school_elo_relative_to_1500"] for r in source if r["prior_school_elo_relative_to_1500"] is not None}
   multi[y],_=multistat_features(roster,old)
  prev_ratings=unadjusted_end(games[y],prev_ratings,schools)
 return games,feats,origins,multi
def score(games,feat,origin,multi,weights):
 # Current best combined non-stat coefficients held fixed to avoid
 # spuriously making the independent stat experiment enormous.
 return trial(games,feat,(1200.,25.,1.,1.,dict(zip(FEATURES,weights))),origin,multi)
def run(games,feat,origin,multi):
 candidates=[]
 for weights in product(WEIGHTS,repeat=3):
  result=score(games,feat,origin,multi,weights)
  candidates.append({"weights":dict(zip(FEATURES,weights)),
   "train_2024":result[2024],"validation_2025":result[2025],
   "reused_diagnostic_2026":result[2026]})
 best=min(candidates,key=lambda x:(x["train_2024"]["log_loss"],sum(x["weights"].values())))
 # Penalize coefficient magnitude in Elo-point units; penalties operate on
 # training log loss only, never on validation results.
 strengths=(0.,0.0001,0.00025,0.0005,0.001)
 regularized={}
 for lam in strengths:
  chosen=min(candidates,key=lambda x:(
   x["train_2024"]["log_loss"]+lam*sum((v/600.)**2 for v in x["weights"].values()),
   sum(x["weights"].values())))
  regularized[str(lam)]={"selected_weights":chosen["weights"],
   "train_log_loss":chosen["train_2024"]["log_loss"],
   "validation_2025":chosen["validation_2025"],
   "reused_2026":chosen["reused_diagnostic_2026"],
   "selected_at_grid_boundary":any(v==max(WEIGHTS) for v in chosen["weights"].values())}
 equal=next(x for x in candidates if all(z==150 for z in x["weights"].values()))
 zero=next(x for x in candidates if all(z==0 for z in x["weights"].values()))
 return {"model":"ncaam-independent-player-stat-coefficients-v1",
 "status":"RETROSPECTIVE_ONLY_PRESEASON_ASOF_NOT_VERIFIED",
 "training_year":2024,"validation_year":2025,"reused_diagnostic_year":2026,
 "selected_weights":best["weights"],"selected_training":best["train_2024"],
 "regularization_sensitivity":regularized,
 "regularization_rule":"L2 penalty on squared normalized weights, selected using 2024 training only; do not optimize penalty on 2025/2026",
 "selected_validation":best["validation_2025"],
 "equal_weights_validation":equal["validation_2025"],
 "no_extra_player_stats_validation":zero["validation_2025"],
 "selected_reused_2026":best["reused_diagnostic_2026"],
 "equal_weights_reused_2026":equal["reused_diagnostic_2026"],
 "selected_at_grid_boundary":any(w==max(WEIGHTS) for w in best["weights"].values()),
 "validation_both_better_than_equal":all(best["validation_2025"][k]<equal["validation_2025"][k] for k in ("log_loss","brier")),
 "games_identical":best["validation_2025"]["games"]==equal["validation_2025"]["games"],
 "auto_promote":False,
 "limitations":["Historical roster membership not proven available before opening game",
 "2026 previously inspected; repeated diagnostic not untouched holdout",
 "Selected quality/origin/turnover coefficients previously chosen using 2024–25",
 "Validation year 2025 has also been inspected in previous studies; do not call it untouched",
 "Venue information not verified; games treated neutral"],
 "grid":candidates}
def main():
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
 p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-independent-stat-weights.json"))
 a=p.parse_args();r=run(*data(a.source));a.out.parent.mkdir(parents=True,exist_ok=True)
 a.out.write_text(json.dumps(r,indent=2)+"\n")
 print(json.dumps({k:v for k,v in r.items() if k!="grid"},indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""Identical-game NCAA historical incumbent-vs-expanded-box-feature diagnostic.
Fixed parameters from prior training studies, 2026 results not used to choose weights.
Historical roster snapshot timestamps remain uncertified; cannot label prospective.
"""
import argparse,json
from pathlib import Path
from calibrate_ncaam_independent_stat_weights import data
from backtest_ncaam_combined_elo import trial

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--source",type=Path,required=True)
 ap.add_argument("--out",type=Path,default=Path("data/ncaam-full-multistat-identical-game-backtest.json"))
 a=ap.parse_args()
 games,features,origins,multi=data(a.source)
 fit=json.loads(Path("data/ncaam-continuous-stat-optimizer.json").read_text())
 assert fit["status"]=="RETROSPECTIVE_ONLY_NOT_PRESEASON_CERTIFIED"
 weights=fit["selected_weights"]
 assert set(weights)=={"shooting","playmaking","defense"}
 # Both models use precisely the same roster, prior strength, origin, churn, K and games.
 # Only the experimental box-score vector differs.
 control=trial(games,features,(1200.,25.,1.,1.,{"shooting":0.,"playmaking":0.,"defense":0.}),origins,multi)
 expanded=trial(games,features,(1200.,25.,1.,1.,weights),origins,multi)
 years={}
 for year in (2024,2025,2026):
  x=control[year];y=expanded[year]
  assert x["games"]==y["games"] and x["games"]>1500
  years[str(year)]={"same_games":True,"games":x["games"],"incumbent":x,"expanded":y,
   "log_loss_improvement":x["log_loss"]-y["log_loss"],
   "brier_improvement":x["brier"]-y["brier"]}
 result={"model":"ncaam-expanded-multistat-fixed-coefficients-head-to-head",
  "status":"RETROSPECTIVE_SAME_GAME_COMPARISON_NOT_CERTIFIED_PRESEASON",
  "training_seasons":[2024,2025],"previously_inspected_diagnostic_season":2026,
  "expanded_coefficients":weights,"identical_games":True,"fixed_coefficients_before_2026_replay":True,
  "data_timestamp_preopening_verified":False,"automatic_promotion":False,
  "model_comparison_note":"Incumbent is the common fixed historical roster-and-quality model without additional shooting/playmaking/defense. It is not an exact replay of the production 2026-27 roster identity system.",
  "years":years,"expanded_wins_2026_both":years["2026"]["log_loss_improvement"]>0 and years["2026"]["brier_improvement"]>0,
  "limitations":["Archive rosters are not certified preopening as-of","2026 diagnostic has already been inspected","Potential overlap between shooting and existing scoring quality","No true venue or possessions verification"]}
 a.out.parent.mkdir(parents=True,exist_ok=True)
 a.out.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({"diagnostic_2026":years["2026"],"automatic_promotion":False},indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""Compare practical rating impacts and optimizer-start agreement.
No production promotion; historical roster snapshots are retrospective.
"""
import argparse,json
from pathlib import Path
from calibrate_ncaam_independent_stat_weights import data
from audit_ncaam_coefficient_impact import diagnose

def main():
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
 p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-continuous-impact-audit.json"))
 a=p.parse_args()
 result=json.loads(Path("historical-report/ncaam-continuous-stat-optimizer.json").read_text())
 _,_,_,multi=data(a.source)
 selected=diagnose({"selected_weights":result["selected_weights"]},multi)
 prior=diagnose({"selected_weights":{"shooting":300.,"playmaking":600.,"defense":450.}},multi)
 starts=result["two_initializations"]
 gaps={k:abs(starts[0]["weights"][i]-starts[1]["weights"][i]) for i,k in enumerate(("shooting","playmaking","defense"))}
 allseasons={}
 for year in selected["actual_stat_elo_effects"]:
  s=selected["actual_stat_elo_effects"][year];old=prior["actual_stat_elo_effects"][year]
  allseasons[year]={"continuous":s,"previous_grid":old}
 report={"model":"ncaam-continuous-optimizer-impact-v1",
   "production_promotion_allowed":False,
   "both_starts_weights":starts[0]["weights"]!=starts[1]["weights"],
   "start_weight_absolute_differences":gaps,
   "starts_training_loss_gap":abs(starts[0]["train_log_loss"]-starts[1]["train_log_loss"]),
   "seasons":allseasons,
   "warnings":["Historical roster as-of date not certified","Repeated validation years are not pristine holdouts","No verified venue correction"]}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+"\n")
 print(json.dumps({"starts_training_loss_gap":report["starts_training_loss_gap"],
   "start_weight_absolute_differences":gaps,
   "continuous_2026":allseasons["2026"]["continuous"]["total_adjustment_elo_points"],
   "previous_grid_2026":allseasons["2026"]["previous_grid"]["total_adjustment_elo_points"]},indent=2))
if __name__=="__main__":main()

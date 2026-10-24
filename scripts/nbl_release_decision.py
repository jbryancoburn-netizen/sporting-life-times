#!/usr/bin/env python3
"""Produce an explicit, reproducible NBL model release decision from existing results.

A healthy pipeline with a withheld model is a success, not a false certification.
Future games are not necessary to determine the current release status.
"""
import argparse,json,math
from pathlib import Path

def decide(coverage,three_season):
    issues=[]
    if coverage.get("2025_26_regular_season_coverage",{}).get("status")!="pass":
        issues.append("Historical schedule/standings reconciliation not passed")
    seasons=three_season.get("season_predictions",{})
    for year in ("2024-25","2025-26","2026-27"):
        score=seasons.get(year,{})
        if not isinstance(score.get("games"),int) or score["games"]<1:
            issues.append("Missing evaluated games: "+year)
        for metric in ("log_loss","brier"):
            if not isinstance(score.get(metric),(float,int)) or not math.isfinite(score[metric]):
                issues.append("Missing finite "+metric+": "+year)
    if three_season.get("publication_approved") is not False:
        issues.append("Research evaluator incorrectly authorizes production")
    current=seasons.get("2026-27",{})
    naive=three_season.get("coin_flip_baseline",{})
    lagged=three_season.get("prior_season_home_rate_baseline",{}).get("2026-27",{})
    benchmarks={}
    for name,ref in (("even_odds",naive),("lagged_home",lagged)):
        b=ref.get("log_loss")
        loss=current.get("log_loss")
        benchmarks[name]={"log_loss":b,"model_better":bool(isinstance(b,(int,float)) and isinstance(loss,(int,float)) and loss<b)}
    if not benchmarks["even_odds"]["model_better"]:issues.append("Current holdout fails 50/50 log-loss benchmark")
    if not benchmarks["lagged_home"]["model_better"]:issues.append("Current holdout fails lagged-home benchmark")
    # Passing predictions alone cannot substitute for outside source confirmation.
    issues.append("Independent game-by-game source verification and parameter calibration incomplete")
    return {"status":"withheld","production_approved":False,
      "historical_data_audited":coverage.get("2025_26_regular_season_coverage",{}).get("status")=="pass",
      "current_season_games_tested":current.get("games"),"benchmark_results":benchmarks,
      "blockers":issues,"requires_future_results_to_run":False}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--audit",required=True)
    p.add_argument("--evaluation",required=True)
    p.add_argument("--output",required=True)
    a=p.parse_args()
    audit=json.loads(Path(a.audit).read_text())
    evaluation=json.loads(Path(a.evaluation).read_text())
    result=decide(audit,evaluation)
    path=Path(a.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
    if not result["historical_data_audited"] or not result["current_season_games_tested"]:
        raise SystemExit(1)

if __name__=="__main__":main()

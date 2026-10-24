#!/usr/bin/env python3
"""Separate ordinary Elo speed and margin response with chronological validation.

The 2026 games were inspected in earlier experiments, so 2026 is a
REUSED diagnostic, not a pristine holdout. Train on 2024, validate on
2025, and report 2026 separately. Historical games are venue-neutral.
"""
import argparse,json,math
from pathlib import Path
from itertools import groupby
from collections import defaultdict
from backtest_ncaam_quality_retrospective import read_gz,extract_games,school_key
from calibrate_ncaam_game_elo import probability

BASE_GRID=(16.,24.,32.,40.,48.)
SLOPE_GRID=(0.,5.,10.,15.,20.,25.)
REFERENCE=math.log10(11)
def replay(games,k,slope):
    ratings={};results={}
    for year in (2023,2024,2025,2026):
        teams={t for g in games[year] for t in (g["home"],g["away"])}
        ratings={t:1500+.65*(ratings.get(t,1500)-1500) for t in teams}
        loss=brier=0.;n=0
        for _day,day_games in groupby(games[year],key=lambda g:g["day"]):
            changes=defaultdict(float)
            for g in day_games:
                h,a=g["home"],g["away"]
                p=probability(ratings[h],ratings[a])
                y=float(g["home_score"]>g["away_score"])
                loss-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12))
                brier+=(p-y)**2;n+=1
                margin=abs(g["home_score"]-g["away_score"])
                rate=max(1.,k+slope*(math.log10(1+margin)-REFERENCE))
                delta=rate*(y-p)
                changes[h]+=delta;changes[a]-=delta
            for t,d in changes.items():ratings[t]+=d
        results[str(year)]={"games":n,"log_loss":loss/n,"brier":brier/n}
    return results
def calibrate(games):
    grid=[]
    for base in BASE_GRID:
        for slope in SLOPE_GRID:
            result=replay(games,base,slope)
            grid.append({"base_k_at_10pt":base,"margin_slope":slope,
                         "training_2024":result["2024"],"validation_2025":result["2025"],
                         "reused_diagnostic_2026":result["2026"]})
    winner=min(grid,key=lambda r:(r["training_2024"]["log_loss"],r["training_2024"]["brier"]))
    reference=replay(games,24*(1+.55*REFERENCE),24*.55)
    return {"model":"SLAT-NCAAM-centered-margin-elo-v1",
      "status":"RESEARCH_VALIDATION_NOT_PRODUCTION",
      "selection_year":2024,"validation_year":2025,
      "reused_diagnostic_year":2026,
      "honest_test_policy":"2026 has been previously inspected; not a fresh untouched holdout",
      "margin_reference":10,"parameter_grid":{"base_k":list(BASE_GRID),"slope":list(SLOPE_GRID)},
      "training_selected":{"base_k_at_10pt":winner["base_k_at_10pt"],"margin_slope":winner["margin_slope"]},
      "validation_selected":winner["validation_2025"],
      "validation_current_formula":reference["2025"],
      "validation_improved_both":winner["validation_2025"]["log_loss"]<reference["2025"]["log_loss"] and winner["validation_2025"]["brier"]<reference["2025"]["brier"],
      "diagnostic_2026_selected":winner["reused_diagnostic_2026"],
      "diagnostic_2026_current_formula":reference["2026"],
      "grid_boundary":winner["base_k_at_10pt"] in (BASE_GRID[0],BASE_GRID[-1]) or winner["margin_slope"] in (SLOPE_GRID[0],SLOPE_GRID[-1]),
      "eligible_for_automatic_live_promotion":False,
      "limitations":["Historical game venue not verified",
        "Current preseason roster strength excluded from comparison",
        "2026 is a reused diagnostic not fresh holdout",
        "Only one independent validation season available"],
      "all_trials":grid}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--source",type=Path,required=True)
    ap.add_argument("--output",type=Path,default=Path("data/ncaam-elo-centered-margin-validation.json"))
    args=ap.parse_args();data={}
    for y in (2023,2024,2025,2026):
        roster=read_gz(args.source,"team_rosters",y)
        programs={school_key(t["team"]):str(t["team_id"]) for t in roster}
        data[y],_=extract_games(read_gz(args.source,"schedule",y),programs,read_gz(args.source,"player_box",y))
        assert len(data[y])>=3000
    result=calibrate(data)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="all_trials"},indent=2))
if __name__=="__main__":main()

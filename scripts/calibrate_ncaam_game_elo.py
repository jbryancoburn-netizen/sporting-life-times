#!/usr/bin/env python3
"""Chronological NCAA team-Elo K/MOV calibration using actual NCAA finals.

Choose on 2024 and 2025 seasons, evaluate selected pair ONCE on untouched
2026. Historical venue is unknown and deliberately neutral for every trial.
No current-season rosters are used in this game-only trial.
"""
import argparse,json,math
from collections import defaultdict
from itertools import groupby
from pathlib import Path
from backtest_ncaam_quality_retrospective import read_gz,extract_games,school_key

K_GRID=(12.,16.,20.,24.,28.,32.,40.)
MOV_GRID=(0.,.25,.55,.85,1.1)
CARRYOVER=.65
def probability(a,b):
    d=max(-1500.,min(1500.,a-b))
    return 1/(1+10**(-d/400))
def evaluate(games_by_year,years,k,mov):
    ratings={}
    loss=0.;brier=0.;n=0
    per_year={}
    for year in (2023,2024,2025,2026):
        games=games_by_year[year]
        teams={x for g in games for x in (g["home"],g["away"])}
        ratings={t:1500+CARRYOVER*(ratings.get(t,1500)-1500) for t in teams}
        l=b=cnt=0.
        for day,group in groupby(games,key=lambda g:g["day"]):
            changes=defaultdict(float)
            for g in group:
                h,a=g["home"],g["away"]
                p=probability(ratings[h],ratings[a])
                result=float(g["home_score"]>g["away_score"])
                if year in years:
                    l-=result*math.log(max(p,1e-12))+(1-result)*math.log(max(1-p,1e-12))
                    b+=(p-result)**2
                    cnt+=1
                margin=abs(g["home_score"]-g["away_score"])
                change=k*(1+mov*math.log10(1+margin))*(result-p)
                changes[h]+=change;changes[a]-=change
            for t,delta in changes.items():
                ratings[t]+=delta
        if year in years:
            loss+=l;brier+=b;n+=cnt
            per_year[str(year)]={"games":int(cnt),"log_loss":l/cnt,"brier":b/cnt}
    if not n:raise ValueError("No historical scored games")
    return {"games":int(n),"log_loss":loss/n,"brier":brier/n,"per_season":per_year}
def calibrate(games):
    if set(games)!={2023,2024,2025,2026}:raise ValueError("Missing historical season")
    grid=[]
    for k in K_GRID:
        for mov in MOV_GRID:
            train=evaluate(games,{2024,2025},k,mov)
            grid.append({"k":k,"mov":mov,**{q:train[q] for q in ("games","log_loss","brier")}})
    winner=min(grid,key=lambda x:(x["log_loss"],x["brier"],x["k"],x["mov"]))
    baseline=next(x for x in grid if x["k"]==24 and x["mov"]==.55)
    selected=evaluate(games,{2026},winner["k"],winner["mov"])
    incumbent=evaluate(games,{2026},24,.55)
    improvement=selected["games"]==incumbent["games"] and selected["log_loss"]<incumbent["log_loss"] and selected["brier"]<incumbent["brier"]
    return {"model":"SLAT-NCAAM-game-Elo-update-parameter-backtest-v1",
       "status":"CHRONOLOGICAL_TEAM_GAME_HOLDOUT_VENUE_UNVERIFIED",
       "train_seasons":[2024,2025],"untouched_holdout_season":2026,
       "prior_replay_season":2023,"carryover":CARRYOVER,
       "selection_rule":"Lowest training log loss, then Brier; no holdout tuning",
       "venue_policy":"All games neutral because historical venue unverified",
       "selected":{"k":winner["k"],"mov":winner["mov"]},
       "baseline_parameters":{"k":24,"mov":.55},
       "training_baseline":baseline,"training_selected":winner,
       "holdout_baseline":incumbent,"holdout_selected":selected,
       "holdout_both_metrics_improved":improvement,
       "selected_at_grid_boundary":winner["k"] in (K_GRID[0],K_GRID[-1]) or winner["mov"] in (MOV_GRID[0],MOV_GRID[-1]),
       "identical_game_count":selected["games"]==incumbent["games"],
       "eligible_for_automatic_live_promotion":False,
       "limitations":["No true home-versus-neutral indicator in historical data",
                      "Game-only Elo trial; not an evaluation of 2026-27 player-quality preseason adjustments",
                      "Live production K and MOV remain unchanged until reviewed"],
       "training_grid":grid}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",type=Path,required=True)
    ap.add_argument("--output",type=Path,default=Path("data/ncaam-elo-k-mov-historical-calibration.json"))
    args=ap.parse_args()
    games={}
    for year in (2023,2024,2025,2026):
        rosters=read_gz(args.source,"team_rosters",year)
        programs={school_key(x["team"]):str(x["team_id"]) for x in rosters}
        schedule=read_gz(args.source,"schedule",year)
        boxes=read_gz(args.source,"player_box",year)
        games[year],_ = extract_games(schedule,programs,boxes)
        if len(games[year])<3000:raise ValueError("Insufficient NCAA finals "+str(year))
    result=calibrate(games)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:result[k] for k in ("selected","training_selected","holdout_baseline","holdout_selected","holdout_both_metrics_improved","selected_at_grid_boundary")},indent=2))
if __name__=="__main__":main()

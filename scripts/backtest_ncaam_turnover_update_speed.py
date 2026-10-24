#!/usr/bin/env python3
"""Retrospective test of roster-turnover-adjusted Elo reaction speed.

NOT a preseason-valid result: historical roster captures have no verified
pre-opening timestamps. Train 2024/25, compare on REUSED 2026 diagnostic.
Uncovered schools retain ordinary Elo speed; don't invent their turnover.
"""
import argparse,json,math,statistics
from pathlib import Path
from collections import defaultdict
from itertools import groupby
from backtest_ncaam_quality_retrospective import read_gz,extract_games,school_key,preseason_features

GAMMA_GRID=(-.75,-.5,-.25,0.,.25,.5,.75,1.)
K=24.; MOV=.55; CARRY=.65
def prob(x,y):return 1/(1+10**(-max(-1500.,min(1500.,x-y))/400))
def run(seasons,features,gamma):
    ratings={};result={}
    for year in (2023,2024,2025,2026):
        games=seasons[year];teams={t for g in games for t in (g["home"],g["away"])}
        ratings={t:1500+CARRY*(ratings.get(t,1500)-1500) for t in teams}
        f=features.get(year,{})
        eligible=[1-v["r"] for v in f.values() if v["covered"]]
        pivot=statistics.median(eligible) if eligible else 0.
        n=eligible_games=0;loss=brier=0.
        for day,batch in groupby(games,key=lambda g:g["day"]):
            changes=defaultdict(float)
            for g in batch:
                h,a=g["home"],g["away"];p=prob(ratings[h],ratings[a])
                y=float(g["home_score"]>g["away_score"])
                loss-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12))
                brier+=(p-y)**2;n+=1
                observed=(h in f and a in f and f[h]["covered"] and f[a]["covered"])
                if observed:eligible_games+=1
                churn=sum((1-f[t]["r"]-pivot) if t in f and f[t]["covered"] else 0. for t in (h,a))/2
                # Correct only first 45 days; reverts to identical baseline thereafter.
                age=(day-games[0]["day"]).days
                factor=max(.5,min(1.5,1+gamma*churn)) if age<45 else 1.
                delta=K*factor*(1+MOV*math.log10(1+abs(g["home_score"]-g["away_score"])))*(y-p)
                changes[h]+=delta;changes[a]-=delta
            for t,change in changes.items():ratings[t]+=change
        result[str(year)]={"games":n,"log_loss":loss/n,"brier":brier/n,"games_with_both_rosters":eligible_games,
                            "roster_feature_timing_verified":False}
    return result
def calibrate(seasons,features):
    trials=[]
    for gamma in GAMMA_GRID:
        vals=run(seasons,features,gamma)
        train=sum(vals[str(y)]["log_loss"]*vals[str(y)]["games"] for y in (2024,2025))/sum(vals[str(y)]["games"] for y in (2024,2025))
        trials.append({"gamma":gamma,"train_log_loss":train,"by_year":vals})
    pick=min(trials,key=lambda x:(x["train_log_loss"],abs(x["gamma"])))
    base=next(x for x in trials if x["gamma"]==0)
    b=base["by_year"]["2026"];c=pick["by_year"]["2026"]
    return {"status":"RETROSPECTIVE_TURNOVER_HYPOTHESIS_NOT_ASOF_PRESEASON",
      "model":"ncaam-roster-dependent-update-speed-research-v1",
      "training":[2024,2025],"reused_diagnostic":2026,
      "training_feature_timing_verified":False,
      "selected_gamma":pick["gamma"],
      "diagnostic_2026_selected":c,"diagnostic_2026_baseline":b,
      "diagnostic_improved_both":c["log_loss"]<b["log_loss"] and c["brier"]<b["brier"],
      "no_automatic_production_promotion":True,
      "design":"First 45 days, team-pair centered returning-minute churn changes K symmetrically; unchanged afterward",
      "limitations":["Historical roster lists may include in-season roster changes, creating future leakage",
                    "2026 holdout has been inspected in other studies",
                    "No independently certified historical preseason roster snapshots",
                    "Neutral-venue prediction, no verified home-court flag"],
      "trials":trials}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--source",type=Path,required=True)
    ap.add_argument("--output",type=Path,default=Path("data/ncaam-turnover-update-speed-retrospective.json"))
    args=ap.parse_args()
    games={};feat={}
    for yr in (2023,2024,2025,2026):
        roster=read_gz(args.source,"team_rosters",yr)
        schools={school_key(x["team"]):str(x["team_id"]) for x in roster}
        games[yr],_=extract_games(read_gz(args.source,"schedule",yr),schools,read_gz(args.source,"player_box",yr))
        assert len(games[yr])>=3000
        if yr>=2024:
            feat[yr],_,_=preseason_features(roster,read_gz(args.source,"player_box",yr-1))
    out=calibrate(games,feat)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps({k:v for k,v in out.items() if k!="trials"},indent=2))
if __name__=="__main__":main()

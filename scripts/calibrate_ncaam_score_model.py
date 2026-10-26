#!/usr/bin/env python3
"""Calibrate a venue-neutral NCAA score model without using future outcomes.

2024/25 training, 2026 untouched season holdout. Pregame Elo reconstructed
chronologically from prior results, not final-season ratings. Historical team
box files provide validated Division I game identity.
"""
import argparse,csv,gzip,json,math,statistics
from pathlib import Path
from collections import defaultdict
from itertools import groupby
from backtest_ncaam_quality_retrospective import read_gz,school_key,extract_games,update_date_batch

def collect(source):
    prior={}
    samples={}
    for season in (2023,2024,2025,2026):
        boxes=read_gz(source,"player_box",season)
        schedule=read_gz(source,"schedule",season)
        teamid=defaultdict(set)
        for r in boxes:
            if r.get("team_ncaa_team_id") and r.get("team"):
                teamid[school_key(r["team"])].add(str(r["team_ncaa_team_id"]))
        programs={k:next(iter(ids)) for k,ids in teamid.items() if len(ids)==1}
        games,_=extract_games(schedule,programs,boxes)
        if len(games)<3000:raise ValueError(f"Unexpectedly few verified games for {season}: {len(games)}")
        ratings={k:1500+.65*(prior.get(k,1500)-1500) for k in programs}
        entries=[]
        for day,day_games in groupby(games,key=lambda g:g["day"]):
            batch=list(day_games)
            for g in batch:
                if g["home"] not in ratings or g["away"] not in ratings:continue
                entries.append({"day":day.isoformat(),"id":g["id"],"elo_diff":ratings[g["home"]]-ratings[g["away"]],
                                "home":g["home_score"],"away":g["away_score"]})
            update_date_batch(ratings,batch)
        samples[season]=entries
        prior=ratings
        print(season,len(entries),flush=True)
    return samples

def error(rows,mean,slope):
    # Report true score errors, including close games; don't force a winner
    # in the continuous-value loss function.
    total=margin=0.
    for g in rows:
        d=g["elo_diff"]*slope
        predicted_home=mean+d/2
        predicted_away=mean-d/2
        total+=(abs(g["home"]-predicted_home)+abs(g["away"]-predicted_away))/2
        margin+=abs((g["home"]-g["away"])-d)
    return {"games":len(rows),"team_score_mae":total/len(rows),"margin_mae":margin/len(rows)}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,default=Path("historical-normalized"))
    parser.add_argument("--out",type=Path,default=Path("data/ncaam-score-calibration.json"))
    a=parser.parse_args()
    years=collect(a.source)
    train=years[2024]+years[2025];holdout=years[2026]
    # No 2026 scores influence parameters.
    mean=statistics.mean((g["home"]+g["away"])/2 for g in train)
    # Linear least squares for actual margins (venue-neutral: venue not verified).
    num=sum(g["elo_diff"]*(g["home"]-g["away"]) for g in train)
    den=sum(g["elo_diff"]**2 for g in train)
    slope=max(.0001,min(.2,num/den))
    base=error(holdout,72.,1/25)
    proposed=error(holdout,mean,slope)
    checks={"training_games":len(train),"holdout_games":len(holdout),
            "date_disjoint":max(g["day"] for g in train)<min(g["day"] for g in holdout),
            "score_mae_delta":base["team_score_mae"]-proposed["team_score_mae"],
            "margin_mae_delta":base["margin_mae"]-proposed["margin_mae"]}
    # Don't activate worse model based on a single better-looking submetric.
    passed=checks["date_disjoint"] and len(holdout)>=3000 and (
        proposed["team_score_mae"]<base["team_score_mae"] and
        proposed["margin_mae"]<base["margin_mae"])
    report={"model":"ncaam-venue-neutral-historical-score-v1",
            "status":"HISTORICAL_HOLDOUT_VALIDATED" if passed else "HOLDOUT_EVALUATED_NOT_PROMOTED",
            "parameters":{"mean_team_points":round(mean,6),"elo_margin_slope":round(slope,8),
                          "margin_cap":28,"minimum_winner_margin":1},
            "training_seasons":[2024,2025],"holdout_season":2026,
            "validation":checks,"holdout_baseline":base,"holdout_challenger":proposed,
            "known_limits":["Current preseason Elo is player-quality-adjusted, while historical pregame ratings use a simpler replay",
                "No verified court venue, possession totals, player availability, or overtime probabilities",
                "Model predicts mean scores; final rounded scores are illustrative rather than certainty intervals"]}
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
if __name__=="__main__":main()

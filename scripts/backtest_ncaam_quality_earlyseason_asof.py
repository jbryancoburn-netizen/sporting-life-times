#!/usr/bin/env python3
"""Strictly time-ordered early-season roster quality backtest (NOT preseason).

Reconstruct each season's active roster using boxscore records dated BEFORE
the season's day-14 evaluation cutoff. Never use a post-cutoff athlete
appearance as a feature. Run 2024 and 2025 training, 2026 untouched holdout.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import timedelta
from pathlib import Path
from backtest_ncaam_quality_retrospective import (
    read_gz,game_day,number,school_key,extract_games,preseason_features,
    unadjusted_end,logistic,game_update,CARRYOVER,BETA_GRID
)
import math

def cut_snapshot(box, cutoff):
    out=[]
    excluded=0
    for record in box:
        if game_day(record["game_date"]) >= cutoff:
            excluded+=1
            continue
        if number(record.get("mins")) <= 0:
            continue
        id_=str(record.get("team_ncaa_team_id") or "")
        team=record.get("team")
        player=record.get("player")
        if not id_ or not team or not player:
            continue
        out.append({"team":team,"team_id":id_,"player":player})
    if not out:
        raise ValueError("No game-sourced roster evidence prior to cutoff")
    return out,excluded

def score_after_cutoff(games,preseason_prior,features,beta,cutoff,window_days=45):
    valid=set(features)
    ratings={t:1500+CARRYOVER*(preseason_prior.get(t,1500)-1500) for t in valid}
    for g in games:
        if g['day'] >= cutoff:
            break
        if g["home"] in ratings and g["away"] in ratings:
            game_update(ratings,g)
    baseline=ratings.copy()
    for team,f in features.items():
        baseline[team]+=f["minute_adj"] + beta*f["q_centered"]
    ratings=baseline.copy()
    games_evaluated=0;ll=0.0;brier=0.0
    end=cutoff+timedelta(days=window_days)
    for g in games:
        if g["day"]<cutoff or g["day"]>=end:
            continue
        if g["home"] not in ratings or g["away"] not in ratings:
            continue
        p=logistic(ratings[g["home"]]-ratings[g["away"]])
        y=1 if g["home_score"]>g["away_score"] else 0
        ll-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12))
        brier+=(p-y)**2
        games_evaluated+=1
        game_update(ratings,g)
    if games_evaluated<100:
        raise ValueError("Insufficient post-cutoff games")
    return {"games":games_evaluated,"log_loss":ll/games_evaluated,"brier":brier/games_evaluated,
            "from":str(cutoff),"through_exclusive":str(end)}

def evaluate(root):
    root=Path(root)
    years=(2023,2024,2025,2026)
    rosters={y:read_gz(root,'team_rosters',y) for y in years}
    box={y:read_gz(root,'player_box',y) for y in years}
    schedule={y:read_gz(root,'schedule',y) for y in years}
    universe={y:{school_key(r["team"]):str(r["team_id"]) for r in rosters[y]} for y in years}
    games={};priors={};features={};audit={};cutoffs={}
    for y in years:
        games[y],_discard=extract_games(schedule[y],universe[y],box[y])
        if not games[y]:
            raise ValueError(f"No usable games {y}")
        priors[y]=unadjusted_end(games[y],priors.get(y-1,{}),universe[y])
        if y==2023:
            continue
        cutoff=games[y][0]["day"]+timedelta(days=14)
        current,removed=cut_snapshot(box[y],cutoff)
        feature,schools,stats=preseason_features(current,box[y-1])
        cutoffs[y]=cutoff
        features[y]=feature
        audit[str(y)]={**stats,"opening_day":str(games[y][0]["day"]),"roster_capture_policy":
                       "first 14 days of dated NCAA player-box entries; no later roster rows",
                       "asof_cutoff":str(cutoff),"postcutoff_box_rows_excluded":removed}
        # All current-season athlete features are defined exclusively from games before cutoff.
        assert all(game_day(r['game_date'])<cutoff for r in box[y] if
                   number(r.get('mins'))>0 and game_day(r['game_date'])<cutoff)
        if max(g["day"] for g in games[y-1])>=min(g["day"] for g in games[y]):
            raise ValueError("Cross-season replay invalid ordering")
    def aggregate(years,beta):
        per={y:score_after_cutoff(games[y],priors[y-1],features[y],beta,cutoffs[y]) for y in years}
        n=sum(x["games"] for x in per.values())
        return {"games":n,"log_loss":sum(x["games"]*x["log_loss"] for x in per.values())/n,
                "brier":sum(x["games"]*x["brier"] for x in per.values())/n,"per_season":per}
    tuning=[(beta,aggregate((2024,2025),beta)) for beta in BETA_GRID]
    chosen=min(tuning,key=lambda x:(x[1]["log_loss"],abs(x[0])))[0]
    train_base=aggregate((2024,2025),0)
    train_new=aggregate((2024,2025),chosen)
    base=aggregate((2026,),0)
    updated=aggregate((2026,),chosen)
    hashes={str(y):{kind:hashlib.sha256(
        (root/f'ncaa_mbb_{kind}_{y}.csv.gz').read_bytes()).hexdigest()
        for kind in ("team_rosters","player_box","schedule")} for y in years}
    return {"experiment":"ncaam-earlyseason-asof-scoring-v1",
            "status":"CHRONOLOGICALLY_VALID_EARLYSEASON_NOT_PRESEASON",
            "preseason_release_approved":False,"asof_current_roster_verified":True,
            "asof_roster_rule":"Use only boxscore appearances within first 14 calendar days, freeze, predict following 45 days",
            "training_seasons":[2024,2025],"holdout_season":2026,
            "selected_quality_beta":chosen,
            "training_minutes":train_base,"training_quality":train_new,
            "holdout_minutes":base,"holdout_quality":updated,
            "holdout_both_improved":updated["log_loss"]<base["log_loss"] and updated["brier"]<base["brier"] and chosen!=0,
            "holdout_log_loss_gain":base["log_loss"]-updated["log_loss"],
            "holdout_brier_gain":base["brier"]-updated["brier"],
            "asof_player_evidence":audit,"source_hashes":hashes,
            "limitations":["No roster is claimed valid before the first game",
                           "Prior-season full boxscore totals are available before the target season",
                           "Active players who did not log a minute in first two weeks cannot enter the features",
                           "Team locations modeled venue-neutral identically for both models",
                           "School-name and exact unique-player-name matching only; unresolved athletes excluded",
                           "This validates scoring add-on after season begins; not 2026-27 PRESEASON roster membership"]}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    result=evaluate(args.source)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:result[k] for k in ("status","selected_quality_beta","training_minutes",
        "training_quality","holdout_minutes","holdout_quality","holdout_both_improved")},indent=2))
if __name__=="__main__":
    main()

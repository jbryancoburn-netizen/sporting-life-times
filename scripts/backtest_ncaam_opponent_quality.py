#!/usr/bin/env python3
"""Backtest whether opponent-quality adjustment adds predictive value to roster continuity.

TRAIN 2024, 2025; LOCKED HOLDOUT 2026. Each season's player quality uses only
the PRIOR season's player-game opponents' PRE-GAME independently replayed Elo.
This is an experiment, not a production ranking or player identity validation.
"""
import json,math
from collections import defaultdict
from pathlib import Path
from backtest_ncaam_roster_elo import fetch,games,end_ratings,clean
from backtest_ncaam_roster_transfers import continuity,evaluate
from build_ncaam_player_opponent_elo import pregame_opponents,exposure

def opponent_quality(box,schedule,team_rows):
    pre=pregame_opponents(schedule,team_rows)
    observed=exposure(box,pre)["player_exposure"]
    by_team=defaultdict(dict)
    for p in observed:
        if p["minutes"]>=200 and p["opponent_pregame_elo"] is not None:
            by_team[p["team_key"]][p["historical_player_id"]]=p
    return by_team

def quality_continuity(box,roster,members,quality,prior_team_ratings=None):
    names=defaultdict(set);old=defaultdict(set)
    minutes=defaultdict(float)
    for r in box:
        team=clean(r.get("team"));name=clean(r.get("clean_name") or r.get("player"))
        pid=str(r.get("player_id") or "")
        if team and name and pid:
            old[(team,name)].add(pid)
            try:m=float(r.get("mins") or 0)
            except (ValueError,TypeError):continue
            if 0<=m<=75:minutes[(team,pid)]+=m
    for r in roster:
        team=clean(r.get("team"));name=clean(r.get("player"))
        if team and name:names[team].add(name)
    teams_by_name=defaultdict(set)
    for team,name in old:teams_by_name[name].add(team)
    weighted=defaultdict(float);weight=defaultdict(float)
    for target in members:
        for name in names.get(target,set()):
            prior=teams_by_name.get(name,set())
            if len(prior)!=1:continue
            source=next(iter(prior))
            ids=old[(source,name)]
            if len(ids)!=1:continue
            pid=next(iter(ids))
            q=quality.get(source,{}).get(pid)
            if q is None:continue
            m=minutes[(source,pid)]
            if m<200:continue
            # Control for source-team strength; raw opponent exposure can proxy
            # for playing at a historically strong school.
            baseline=(prior_team_ratings or {}).get(source,1500.)
            weighted[target]+=(q["opponent_pregame_elo"]-baseline)*m
            weight[target]+=m
    return {t:weighted[t]/weight[t] for t in members if weight[t]>=1000}

def evaluate_quality(schedule,previous,features,quality,beta,days=45,roster_betas=(120,160),require_quality=True):
    valid={t for t in features if t in quality} if require_quality else {t for g in schedule for t in (g[2],g[3])}
    if len(valid)<200:raise ValueError("Insufficient quality feature coverage")
    end=schedule[0][0].toordinal()+days-1
    mk=sorted(x["retention"] for x in features.values())[len(features)//2]
    mt=sorted(x["incoming_minutes"] for x in features.values())[len(features)//2]
    quality_values=sorted(quality.values())
    mq=quality_values[len(quality_values)//2]
    # Keep retention and incoming coefficients fixed to previously trained
    # +120/+160. Only train opponent-quality slope on training seasons.
    ratings={t:1500+.65*(previous.get(t,1500)-1500)+
        (roster_betas[0]*(features[t]["retention"]-mk)+roster_betas[1]*(features[t]["incoming_minutes"]-mt)
         if t in features else 0)+
        (beta*(quality[t]-mq)/100 if t in quality else 0)
        for t in {x for g in schedule for x in (g[2],g[3])}}
    ll=0.;bs=0.;n=0
    for day,gid,h,a,hs,aws in schedule:
        if day.toordinal()>end:break
        if h in valid and a in valid:
            p=1/(1+10**(-(ratings[h]-ratings[a])/400))
            y=int(hs>aws)
            ll-=y*math.log(max(1e-9,p))+(1-y)*math.log(max(1e-9,1-p))
            bs+=(p-y)**2;n+=1
        from backtest_ncaam_roster_elo import step
        step(ratings,h,a,hs,aws)
    if n<150:raise ValueError("Too few evaluation games "+str(n))
    return {"games":n,"log_loss":ll/n,"brier":bs/n}

def run():
    seasons={}
    for year in (2023,2024,2025,2026):
        team=fetch("ncaa_mbb_team_ids",year)
        sched,members=games(fetch("ncaa_mbb_schedule",year),team)
        seasons[year]={"members":members,"schedule":sched,"team":team}
        if year<2026:
            box=fetch("ncaa_mbb_player_box",year)
            seasons[year]["box"]=box
            seasons[year]["end"]=end_ratings(sched,members)
            seasons[year]["quality"]=opponent_quality(box,fetch("ncaa_mbb_schedule",year),team)
        if year>=2024:seasons[year]["roster"]=fetch("ncaa_mbb_rosters",year)
    data={}
    for year in (2024,2025,2026):
        prior=seasons[year-1];now=seasons[year]
        f=continuity(prior["box"],now["roster"],now["members"])
        q=quality_continuity(prior["box"],now["roster"],now["members"],prior["quality"],prior["end"])
        data[year]={"features":f,"quality":q,"coverage":len(q)}
    # Wide predeclared search checks whether the prior optimum sat on a grid edge.
    slopes=(-240,-200,-160,-120,-80,-40,-20,0,20,40,80,120,160,200,240)
    train=[]
    for beta in slopes:
        scores=[evaluate_quality(seasons[y]["schedule"],seasons[y-1]["end"],
            data[y]["features"],data[y]["quality"],beta) for y in (2024,2025)]
        n=sum(s["games"] for s in scores)
        train.append({"beta_per_100_opponent_elo":beta,"games":n,
            "log_loss":sum(s["games"]*s["log_loss"] for s in scores)/n})
    best=min(train,key=lambda x:(x["log_loss"],abs(x["beta_per_100_opponent_elo"])))
    train_by_season={}
    for year in (2024,2025):
        train_by_season[str(year)]={}
        for beta in (0,best["beta_per_100_opponent_elo"]):
            train_by_season[str(year)][str(beta)]=evaluate_quality(
                seasons[year]["schedule"],seasons[year-1]["end"],
                data[year]["features"],data[year]["quality"],beta)
    edge_solution=best["beta_per_100_opponent_elo"] in (min(slopes),max(slopes))
    base=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
        data[2026]["features"],data[2026]["quality"],0)
    hold=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
        data[2026]["features"],data[2026]["quality"],best["beta_per_100_opponent_elo"])
    windows={}
    for days in (14,30,45):
        reference=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
            data[2026]["features"],data[2026]["quality"],0,days=days)
        adjusted=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
            data[2026]["features"],data[2026]["quality"],best["beta_per_100_opponent_elo"],days=days)
        windows[str(days)]={"games":reference["games"],
            "baseline_log_loss":reference["log_loss"],"adjusted_log_loss":adjusted["log_loss"],
            "logloss_gain":reference["log_loss"]-adjusted["log_loss"],
            "brier_gain":reference["brier"]-adjusted["brier"]}
    windows_positive=all(v["logloss_gain"]>0 and v["brier_gain"]>0 for v in windows.values())
    game_only=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
        data[2026]["features"],data[2026]["quality"],0,roster_betas=(0,0))
    game_only_windows={}
    for days in (14,30,45):
        plain=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
            data[2026]["features"],data[2026]["quality"],0,days=days,roster_betas=(0,0))
        adjusted=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
            data[2026]["features"],data[2026]["quality"],best["beta_per_100_opponent_elo"],days=days)
        game_only_windows[str(days)]={"games":plain["games"],
            "game_only_log_loss":plain["log_loss"],"adjusted_log_loss":adjusted["log_loss"],
            "logloss_gain":plain["log_loss"]-adjusted["log_loss"],
            "brier_gain":plain["brier"]-adjusted["brier"]}
    all_game_only_windows_improve=all(x["logloss_gain"]>0 and x["brier_gain"]>0 for x in game_only_windows.values())
    # Also compare coverage honestly: the model has missing quality features.
    # A common-game comparison is useful but cannot stand in for all D1 games.
    full_game_only=evaluate_quality(seasons[2026]["schedule"],seasons[2025]["end"],
        data[2026]["features"],data[2026]["quality"],0,
        roster_betas=(0,0),require_quality=False)
    gain=base["log_loss"]-hold["log_loss"]
    brier_gain=base["brier"]-hold["brier"]
    return {"experiment":"ncaa-opponent-exposure-residualized-calibration-v3-date-batched",
        "quality_feature":"minutes-weighted prior opponent pregame Elo minus prior source team end Elo",
        "training_seasons":[2024,2025],"untouched_holdout":2026,
        "training_winner":best,"training_candidates":train,
        "training_grid_edge_solution":edge_solution,
        "training_grid_values":list(slopes),
        "training_year_diagnostics":train_by_season,
        "holdout_baseline":base,"holdout_adjusted":hold,
        "holdout_game_only":game_only,
        "holdout_all_games_game_only":full_game_only,
        "head_to_head_is_coverage_subset":game_only["games"]<full_game_only["games"],
        "holdout_game_only_window_sensitivity":game_only_windows,
        "all_game_only_windows_improve":all_game_only_windows_improve,
        "adjusted_vs_game_only_logloss_gain":game_only["log_loss"]-hold["log_loss"],
        "adjusted_vs_game_only_brier_gain":game_only["brier"]-hold["brier"],
        "holdout_logloss_gain":gain,"holdout_brier_gain":brier_gain,
        "holdout_window_sensitivity":windows,
        "holdout_all_windows_improve_both_metrics":windows_positive,
        "quality_team_coverage":{str(y):data[y]["coverage"] for y in data},
        "validated_incremental_gain":gain>0.0002 and brier_gain>0.00005 and not edge_solution and windows_positive,
        "same_day_opponent_elo_snapshot":"Date-batched pregame snapshots prevent same-day result leakage",
        "preseason_information_integrity_verified":False,
        "approved_for_primary":False,
        "limitations":["Historical roster snapshot timing unverified",
            "Exact name joins are provisional identities",
            "Competition quality is opponent pregame team Elo, not player impact",
            "Home court not identified in historical schedules"]}
if __name__=="__main__":
    result=run()
    Path("data/ncaam-opponent-quality-backtest.json").write_text(json.dumps(result,indent=2)+chr(10))
    print(json.dumps({k:v for k,v in result.items() if k!="training_candidates"},indent=2))

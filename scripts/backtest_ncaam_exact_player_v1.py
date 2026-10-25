#!/usr/bin/env python3
"""Exact 300-Elo-per-PPM NCAA player-value v1 historical challenge.

Matches scripts/rebuild_ncaam_player_value_experimental.py's arithmetic:
  mean of eligible prior player PPMs; mins/(mins+500) shrinkage;
  prior minutes / prior games capped at 40; max 200 projected minutes/team;
  league-median centering; 300 Elo per adjusted player PPM.

Historical school rosters in this archive are retrospective, not frozen
preseason snapshots. Never authorize primary Elo promotion from this study.
"""
import argparse,hashlib,json,math,statistics
from collections import defaultdict
from datetime import timedelta
from itertools import groupby
from pathlib import Path
from backtest_ncaam_quality_retrospective import (
    read_gz,school_key,player_key,collect_prior_stats,
    extract_games,unadjusted_end,logistic,update_date_batch,CARRYOVER)
BETA=300.0
def exact_features(current_rosters,previous_boxes,team_universe):
    previous,_,_,_,ambiguous=collect_prior_stats(previous_boxes)
    school_players=defaultdict(set)
    for r in current_rosters:
        team=school_key(r.get("team"))
        if team in team_universe:
            name=player_key(r.get("player"))
            if name:
                school_players[team].add(name)
    matched=[]
    for team,names in school_players.items():
        for name in names:
            prior=previous.get(name)
            if prior is None:continue
            school,minutes,points,games=prior
            if minutes>0 and games>0 and points>=0:
                matched.append((team,name,school,minutes,points,games))
    if not matched:raise ValueError("no verified unique prior-season player identities")
    mean=sum(pts/minutes for _,_,_,minutes,pts,_ in matched)/len(matched)
    per_team=defaultdict(list)
    for team,name,school,minutes,points,games in matched:
        mpg=min(40.,minutes/games)
        shrink=min(1.,minutes/(minutes+500.))
        value=mean+shrink*(points/minutes-mean)
        per_team[team].append((mpg,value))
    index={}
    for team in team_universe:
        people=per_team[team]
        total=sum(m for m,_ in people)
        scale=min(1.,200./total) if total else 1.
        index[team]=sum(m*scale*(value-mean) for m,value in people)/200.
    center=statistics.median(index.values())
    delta={team:round(BETA*(v-center),4) for team,v in index.items()}
    assert len(delta)==len(team_universe)
    return delta,{"unique_prior_player_matches":len(matched),
        "ambiguous_prior_player_names_excluded":ambiguous,
        "current_school_count":len(team_universe),
        "no_prior_match_schools":sum(not per_team[t] for t in team_universe),
        "mean_eligible_prior_points_per_minute":mean,
        "median_center":center,"quality_coefficient":BETA}
def evaluate_window(games,previous_end,universe,delta,days=45):
    assert set(delta)==set(universe)
    opening=games[0]["day"];limit=opening+timedelta(days=days)
    ratings={t:1500+CARRYOVER*(previous_end.get(t,1500)-1500)+delta[t] for t in universe}
    ll=brier=0.;n=0
    for day,grp in groupby(games,key=lambda g:g["day"]):
        matches=list(grp)
        if day<limit:
            for g in matches:
                if g["home"] not in ratings or g["away"] not in ratings:continue
                p=logistic(ratings[g["home"]]-ratings[g["away"]])
                y=float(g["home_score"]>g["away_score"])
                ll-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12))
                brier+=(p-y)**2;n+=1
        update_date_batch(ratings,matches)
    if n<100:raise ValueError("too few head-to-head games")
    return {"games":n,"log_loss":ll/n,"brier":brier/n}
def run(source):
    source=Path(source);years=(2023,2024,2025,2026)
    roster={y:read_gz(source,"team_rosters",y) for y in years}
    box={y:read_gz(source,"player_box",y) for y in years}
    schedule={y:read_gz(source,"schedule",y) for y in years}
    programs={}
    for y in years:
        ids=defaultdict(set)
        for r in box[y]:
            team=school_key(r.get("team"))
            tid=str(r.get("team_ncaa_team_id") or "")
            if team and tid:ids[team].add(tid)
        programs[y]={t:next(iter(v)) for t,v in ids.items() if len(v)==1}
        if len(programs[y])<300:raise ValueError("incomplete team ID universe")
    games={};end={};features={};evidence={}
    for y in years:
        games[y],_=extract_games(schedule[y],programs[y],box[y])
        if len(games[y])<500:raise ValueError("too few NCAA results")
        end[y]=unadjusted_end(games[y],end.get(y-1,{}),programs[y])
        if y>2023:
            features[y],evidence[str(y)]=exact_features(roster[y],box[y-1],programs[y])
            assert max(g["day"] for g in games[y-1])<min(g["day"] for g in games[y])
    results={}
    for y in (2024,2025,2026):
        baseline=evaluate_window(games[y],end[y-1],programs[y],{t:0. for t in programs[y]})
        candidate=evaluate_window(games[y],end[y-1],programs[y],features[y])
        if baseline["games"]!=candidate["games"]:raise ValueError("mismatched contests")
        results[str(y)]={"baseline":baseline,"exact_beta_300":candidate,
            "log_loss_gain":baseline["log_loss"]-candidate["log_loss"],
            "brier_gain":baseline["brier"]-candidate["brier"]}
    hashes={str(y):{kind:hashlib.sha256(
      (source/f"ncaa_mbb_{kind}_{y}.csv.gz").read_bytes()).hexdigest()
      for kind in ("team_rosters","player_box","schedule")} for y in years}
    return {"experiment":"ncaam-exact-player-value-v1-beta-300",
        "status":"RETROSPECTIVE_EXACT_FORMULA_DIAGNOSTIC_NOT_PRESEASON_ASOF_CERTIFIED",
        "formula_beta":300,"training_seasons":[2024,2025],
        "untouched_holdout_season":2026,"comparison_window_days":45,
        "historical_results":results,"source_hashes":hashes,
        "evidence":evidence,"strict_preopening_rosters_verified":False,
        "production_approval":False,
        "limitations":["Retrospectively collected full-year school roster files cannot verify membership before season opening.",
            "Matching is restricted to unique exact normalized prior-year player names; 2026-27 production uses linked IDs.",
            "Venue-neutral independent Elo for both compared models.",
            "No 2026 holdout results used to tune beta; the original model fixes beta at 300.",
            "Do not promote 2026-27 preseason player-value v1 from this retrospective test."]}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",required=True,type=Path)
    ap.add_argument("--output",type=Path,default=Path("data/ncaam-exact-player-v1-retrospective-challenge.json"))
    args=ap.parse_args()
    result=run(args.source)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"status":result["status"],"holdout_2026":result["historical_results"]["2026"],
      "production_approval":result["production_approval"]},indent=2))
if __name__=="__main__":main()

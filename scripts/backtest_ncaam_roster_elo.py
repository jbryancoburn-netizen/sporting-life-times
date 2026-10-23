#!/usr/bin/env python3
"""Empirical, time-ordered calibration of offseason college basketball Elo.

Independent NCAA-origin historical score/box/roster data. Train only on
2023->24 and 2024->25; reserve 2025->26 as a true chronological holdout.
Neither other providers' team ratings nor future game outcomes are used as
features. No home edge (historical schedule has no verified neutral flag).
Outputs an experiment report; publication only if held-out log loss AND
Brier score beat the unchanged 65%-carryover Elo baseline.
"""
import csv,gzip,json,math,re,urllib.request
from collections import defaultdict,Counter
from datetime import datetime
from pathlib import Path

URL="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/"
def clean(s):return re.sub("[^a-z0-9]","",str(s or "").lower().replace("&","and"))
def fetch(dataset,year):
    key=f"{dataset}_{year}"
    url=f"{URL}{dataset}/{key}.csv.gz"
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"}),timeout=120) as f:
        raw=gzip.decompress(f.read(25000000)).decode("utf-8-sig")
    out=list(csv.DictReader(raw.splitlines()))
    if not out:raise ValueError("Empty dataset: "+url)
    return out

def games(sched,team_rows):
    members={clean(x["team"]) for x in team_rows}
    unique=set();out=[]
    for row in sched:
        a,b=clean(row.get("home")),clean(row.get("away"))
        gid=str(row.get("contest_id","")).strip()
        if not gid or a not in members or b not in members or a==b:continue
        try:
            day=datetime.strptime(row["game_date"],"%m/%d/%Y").date()
            hs,aws=int(row["home_score"]),int(row["away_score"])
            if hs<0 or aws<0 or hs==aws:continue
        except (ValueError,TypeError,KeyError):continue
        if gid in unique:raise ValueError("Duplicate NCAA contest ID "+gid)
        unique.add(gid)
        out.append((day,gid,a,b,hs,aws))
    out.sort(key=lambda x:(x[0],x[1]))
    return out,members

def step(r,a,b,hs,aws):
    p=1/(1+10**(-(r[a]-r[b])/400))
    margin=abs(hs-aws)
    diff=24*(1+.55*math.log10(1+margin))*((hs>aws)-p)
    r[a]+=diff;r[b]-=diff
    return p

def end_ratings(rows,members):
    r={t:1500.0 for t in members}
    for _,_,a,b,hs,aws in rows:step(r,a,b,hs,aws)
    return r

def prior_minutes(stats):
    player=defaultdict(float);byname=defaultdict(set)
    for x in stats:
        t=clean(x.get("team"))
        name=clean(x.get("clean_name") or x.get("player"))
        pid=str(x.get("player_id") or "").strip()
        if not t or not name:continue
        try:minutes=float(x.get("mins") or 0)
        except ValueError:continue
        if not (0<=minutes<=75):continue
        ident=pid if pid else "name:"+name
        player[(t,ident)]+=minutes
        byname[(t,name)].add(ident)
    return player,byname

def features(stats,rosters,members):
    minutes,ids=prior_minutes(stats)
    previous=defaultdict(float)
    for (team,player),m in minutes.items():previous[team]+=m
    players=defaultdict(set)
    for row in rosters:
        name=clean(row.get("player"));team=clean(row.get("team"))
        if name and team:players[team].add(name)
    # Match only single identities within a school and name. No fuzzy merges.
    fractions={};coverage={}
    for team in members:
        roster=players.get(team,set());total=previous.get(team,0)
        matched_ids=set()
        for name in roster:
            people=ids.get((team,name),set())
            if len(people)==1:matched_ids.update(people)
        retained=sum(minutes.get((team,pid),0) for pid in matched_ids)
        if total>=1000 and len(roster)>=8:
            fractions[team]=min(1.0,retained/total)
            coverage[team]={"roster":len(roster),"prior_minutes":round(total,1)}
    return fractions,coverage

def trial(next_games,prior,feat,beta,limit_days=45):
    if not next_games:raise ValueError("No current games")
    cutoff=next_games[0][0].toordinal()+limit_days-1
    ids={x for g in next_games for x in (g[2],g[3])}
    # Centered features do not create a league-wide inflation.
    median=sorted(feat.values())[len(feat)//2] if feat else 0
    rating={t:1500+.65*(prior.get(t,1500)-1500)+beta*(feat[t]-median if t in feat else 0) for t in ids}
    losses=[];briers=[];paired=0;eligible=0
    for day,gid,a,b,hs,aws in next_games:
        if day.toordinal()>cutoff:break
        if a in feat and b in feat:
            p=1/(1+10**(-(rating[a]-rating[b])/400))
            actual=int(hs>aws)
            losses.append(-(actual*math.log(max(1e-9,p))+(1-actual)*math.log(max(1e-9,1-p))))
            briers.append((p-actual)**2)
            paired+=1
        eligible+=1
        step(rating,a,b,hs,aws)
    if not paired:raise ValueError("Zero feature-covered validation games")
    return {"games":paired,"all_d1_games_window":eligible,"coverage":round(paired/eligible,4),
            "log_loss":sum(losses)/paired,"brier":sum(briers)/paired}

def build():
    all_games={};all_teams={};prior_end={};box={};roster={}
    for season in range(2023,2027):
        sched=fetch("ncaa_mbb_schedule",season)
        team=fetch("ncaa_mbb_team_ids",season)
        all_games[season],all_teams[season]=games(sched,team)
        if len(all_games[season])<4500 or len(all_teams[season])<350:raise ValueError("Invalid game or roster coverage "+str(season))
        if season<=2025:
            prior_end[season]=end_ratings(all_games[season],all_teams[season])
            box[season]=fetch("ncaa_mbb_player_box",season)
        if season>=2024:
            roster[season]=fetch("ncaa_mbb_rosters",season)
    transitions={}
    for endyear in (2024,2025,2026):
        ft,coverage=features(box[endyear-1],roster[endyear],all_teams[endyear])
        if len(ft)<250:raise ValueError("Insufficient roster continuity coverage "+str(endyear)+" : "+str(len(ft)))
        transitions[endyear]={"feat":ft,"coverage":len(ft),"prior":prior_end[endyear-1],"games":all_games[endyear]}
    candidates=[-240,-180,-120,-80,-40,-20,0,20,40,80,120,180,240]
    train=[]
    for beta in candidates:
        results=[trial(transitions[y]["games"],transitions[y]["prior"],transitions[y]["feat"],beta) for y in (2024,2025)]
        total=sum(x["games"] for x in results)
        loss=sum(x["games"]*x["log_loss"] for x in results)/total
        train.append({"beta":beta,"games":total,"log_loss":round(loss,8)})
    # Select by training only; use smaller absolute coefficient on ties.
    winning=min(train,key=lambda x:(x["log_loss"],abs(x["beta"])))
    base=trial(transitions[2026]["games"],transitions[2026]["prior"],transitions[2026]["feat"],0)
    hold=trial(transitions[2026]["games"],transitions[2026]["prior"],transitions[2026]["feat"],winning["beta"])
    gain=base["log_loss"]-hold["log_loss"]
    brier_gain=base["brier"]-hold["brier"]
    approved=winning["beta"]!=0 and gain>0.0002 and brier_gain>0 and hold["coverage"]>=0.65
    return {"experiment":"ncaa-d1-offseason-retention-backtest-v1",
      "train_years":[2024,2025],"holdout_year":2026,"first_days_per_season":45,
      "source_family":"NCAA-origin scoreboards / player box / rosters, via SportsDataverse",
      "model":"Independent venue-neutral 24K margin-aware Elo with .65 annual carryover",
      "feature":"Verified player returning minutes / previous-season total minutes, exact team/player identity only",
      "parameters_tested":train,"selected_beta":winning["beta"],
      "train_baseline":next(x for x in train if x["beta"]==0),
      "train_best":winning,
      "holdout_baseline":base,"holdout_adjusted":hold,
      "holdout_log_loss_gain":round(gain,8),"holdout_brier_gain":round(brier_gain,8),
      "team_feature_coverage":{str(y):transitions[y]["coverage"] for y in transitions},
      "release_approved":approved,
      "caveats":["Venue status unavailable historically; evaluated as neutral throughout",
                 "Retrospective roster lists may reflect in-season roster updates",
                 "Exact player-name joins exclude aliases and are incomplete",
                 "One chronologically held-out season; further seasons required before final production model"],
      "decision":("Holdout improvement validated; model only experimental pending alias and temporal roster audit" if approved
                  else "Do not adjust 2026-27 published Elo; held-out evidence does not justify coefficient")}
def main():
    result=build()
    path=Path("data/ncaam-offseason-retention-backtest.json")
    path.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:result[k] for k in ("selected_beta","team_feature_coverage","train_best",
                   "holdout_baseline","holdout_adjusted","release_approved","decision")},indent=2))
if __name__=="__main__":main()

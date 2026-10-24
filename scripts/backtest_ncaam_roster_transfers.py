#!/usr/bin/env python3
"""Independent 2-feature NCAA men's offseason Elo experiment.

Adds verified D1-to-D1 incoming-transfer prior minutes, with an exact
unambiguous name join. Training: 2024+2025 opening windows. Locked test:
2026 opening window. Do not turn a held-out failure into production ratings.
"""
import csv,json,math
from collections import defaultdict
from pathlib import Path
from backtest_ncaam_roster_elo import fetch,games,end_ratings,clean,prior_minutes,step

def continuity(prior_stats,new_roster,members):
    minutes,_=prior_minutes(prior_stats)
    teams=defaultdict(set);bynames=defaultdict(set)
    all_minutes=defaultdict(float)
    for row in prior_stats:
        team=clean(row.get("team"))
        player=clean(row.get("clean_name") or row.get("player"))
        if not team or not player:continue
        try:m=float(row.get("mins") or 0)
        except ValueError:continue
        if m<0 or m>75:continue
        bynames[(team,player)].add(row.get("player_id") or "name:"+player)
        all_minutes[(team,player)]+=m
        if m>0:teams[player].add(team)
    current=defaultdict(set)
    for row in new_roster:
        team=clean(row.get("team"));name=clean(row.get("player"))
        if team and name:current[team].add(name)
    output={}
    for team in members:
        names=current.get(team,set())
        prior_total=sum(m for (old_t,_),m in all_minutes.items() if old_t==team)
        if prior_total<1000 or len(names)<8:continue
        kept=sum(mins for (old_t,p),mins in all_minutes.items() if old_t==team and p in names and len(bynames[(team,p)])==1)
        transferred=0
        for p in names:
            old=teams.get(p,set())
            if len(old)!=1 or team in old:continue
            old_team=next(iter(old))
            if len(bynames[(old_team,p)])!=1:continue
            transferred+=all_minutes.get((old_team,p),0)
        output[team]={"retention":min(1,kept/prior_total),
                      "incoming_minutes":min(1.5,transferred/prior_total),
                      "prior_minutes":round(prior_total,1)}
    return output

def evaluate(schedule,previous,feature,params,days=45):
    end=schedule[0][0].toordinal()+days-1
    teams={t for game in schedule for t in (game[2],game[3])}
    median_keep=sorted(f["retention"] for f in feature.values())[len(feature)//2]
    median_transfer=sorted(f["incoming_minutes"] for f in feature.values())[len(feature)//2]
    beta_k,beta_t=params
    ratings={t:1500+.65*(previous.get(t,1500)-1500)+(
        beta_k*(feature[t]["retention"]-median_keep)+
        beta_t*(feature[t]["incoming_minutes"]-median_transfer) if t in feature else 0)
        for t in teams}
    logloss=0;brier=0;count=0;window=0
    for day,gid,h,a,hs,aws in schedule:
        if day.toordinal()>end:break
        window+=1
        if h in feature and a in feature:
            prob=1/(1+10**(-(ratings[h]-ratings[a])/400))
            actual=int(hs>aws)
            logloss-=actual*math.log(max(1e-9,prob))+(1-actual)*math.log(max(1e-9,1-prob))
            brier+=(prob-actual)**2
            count+=1
        step(ratings,h,a,hs,aws)
    if count<200:raise ValueError("Insufficient source coverage")
    return {"games":count,"coverage":round(count/window,4),"log_loss":logloss/count,"brier":brier/count}

def run():
    transitions={}
    for year in (2023,2024,2025,2026):
        team=fetch("ncaa_mbb_team_ids",year)
        schedule,members=games(fetch("ncaa_mbb_schedule",year),team)
        if len(schedule)<4500:raise ValueError("Season games incomplete "+str(year))
        transitions[year]={"members":members,"games":schedule}
        if year<2026:
            transitions[year]["end"]=end_ratings(schedule,members)
            transitions[year]["box"]=fetch("ncaa_mbb_player_box",year)
        if year>=2024:
            transitions[year]["roster"]=fetch("ncaa_mbb_rosters",year)
    feats={year:continuity(transitions[year-1]["box"],transitions[year]["roster"],transitions[year]["members"]) for year in (2024,2025,2026)}
    if min(map(len,feats.values()))<250:raise ValueError("Unverified transfer coverage")
    values=[-160,-120,-80,-40,-20,0,20,40,80,120,160]
    train=[]
    for retain in values:
        for incoming in values:
            params=(retain,incoming)
            scores=[evaluate(transitions[y]["games"],transitions[y-1]["end"],feats[y],params) for y in (2024,2025)]
            n=sum(s["games"] for s in scores)
            loss=sum(s["log_loss"]*s["games"] for s in scores)/n
            train.append({"retention_beta":retain,"transfer_beta":incoming,"games":n,"log_loss":round(loss,8)})
    winner=min(train,key=lambda x:(x["log_loss"],abs(x["retention_beta"])+abs(x["transfer_beta"])))
    base=evaluate(transitions[2026]["games"],transitions[2025]["end"],feats[2026],(0,0))
    hold=evaluate(transitions[2026]["games"],transitions[2025]["end"],feats[2026],(winner["retention_beta"],winner["transfer_beta"]))
    delta=base["log_loss"]-hold["log_loss"]
    diff_b=base["brier"]-hold["brier"]
    # Convergence threshold prevents "winning" on measurement noise alone.
    approved=(delta>0.0002 and diff_b>0.00005 and hold["coverage"]>.65)

    # Independent shrinkage challenge. Fit 0/25/50/75/100% on 2024+25 only.
    strengths=(0.0,0.25,0.5,0.75,1.0)
    rows=[]
    for strength in strengths:
        params=(strength*winner["retention_beta"],strength*winner["transfer_beta"])
        training=[evaluate(transitions[y]["games"],transitions[y-1]["end"],feats[y],params) for y in (2024,2025)]
        n=sum(x["games"] for x in training)
        rows.append({"strength":strength,"training_games":n,
                     "training_log_loss":sum(x["games"]*x["log_loss"] for x in training)/n,
                     "training_brier":sum(x["games"]*x["brier"] for x in training)/n})
    chosen=min(rows,key=lambda r:(r["training_log_loss"],r["training_brier"],r["strength"]))
    holdouts=[]
    for row in rows:
        strength=row["strength"]
        scored=evaluate(transitions[2026]["games"],transitions[2025]["end"],feats[2026],
                       (strength*winner["retention_beta"],strength*winner["transfer_beta"]))
        holdouts.append({**row,"holdout":scored})
    assert len({r["holdout"]["games"] for r in holdouts})==1
    selected=next(x for x in holdouts if x["strength"]==chosen["strength"])
    original=next(x for x in holdouts if x["strength"]==1.0)
    shrinkage={"training_selection":"minimize 2024+2025 log loss, then Brier, then smaller strength",
       "tested_strengths":holdouts,"selected_strength":chosen["strength"],
       "selection_holdout_logloss_delta_vs_incumbent":original["holdout"]["log_loss"]-selected["holdout"]["log_loss"],
       "selection_holdout_brier_delta_vs_incumbent":original["holdout"]["brier"]-selected["holdout"]["brier"],
       "same_game_count":selected["holdout"]["games"],
       "historical_preseason_asof_certified":False,
       "promote_to_primary":False}
    return {"experiment":"ncaa-roster-elo-retention-and-incoming-minutes-v2",
      "source":"NCAA-origin historical player box and rosters via SportsDataverse",
      "train_seasons":[2024,2025],"untouched_holdout_season":2026,"first_days":45,
      "features":["returning share of previous team minutes","incoming D1 transfer prior minutes share"],
      "shrinkage_challenge":shrinkage,
      "training":winner,"training_baseline":next(t for t in train if t["retention_beta"]==0 and t["transfer_beta"]==0),
      "test_baseline":base,"test_candidate":hold,"test_logloss_gain":round(delta,8),
      "test_brier_gain":round(diff_b,8),"team_feature_coverage":{str(y):len(feats[y]) for y in feats},
      "approved_for_shadow_experiment":approved,"approved_for_primary":False,
      "limitations":["2025-26 data evaluated as neutral-court","Historical source rosters may reflect in-season joins",
                     "Ambiguous name aliases excluded rather than guessed",
                     "Transfers from D2/international programs not captured",
                     "Current 2026-27 school roster coverage incomplete"],
      "decision":"Shadow-model candidate only; primary independent Elo remains unchanged pending production safeguards" if approved else "Candidate failed conservative validation; leave production Elo unchanged"}
def main():
    o=run()
    p=Path("data/ncaam-offseason-transfer-backtest.json")
    p.write_text(json.dumps(o,indent=2)+"\n")
    print(json.dumps({k:o[k] for k in ("training","test_baseline","test_candidate","test_logloss_gain",
            "test_brier_gain","team_feature_coverage","approved_for_shadow_experiment","decision")},indent=2))
if __name__=="__main__":main()

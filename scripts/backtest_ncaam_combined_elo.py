#!/usr/bin/env python3
"""Combined independent NCAA roster, scoring quality, transfer-origin and Elo speed experiment.
Retrospective roster archives lack pre-opening verification; never promote.
Train 2024–25, report previously inspected 2026 only as diagnostic.
"""
import argparse,json,math,statistics
from pathlib import Path
from collections import defaultdict
from itertools import groupby,product
from backtest_ncaam_quality_retrospective import (
 read_gz,extract_games,school_key,preseason_features)
from backtest_ncaam_turnover_update_speed import prob

CARRY=.65; K=24.; MOV=.55
# Explicit small comparison, not a claim of globally optimized parameters.
QUALITY=(0.,400.,1200.)
ORIGIN=(0.,10.,25.)
CHURN=(0.,.5,1.)

def trial(games,feature,config):
 quality,origin,churn_gamma=config
 elo={}
 reports={}
 for year in (2023,2024,2025,2026):
  g=games[year]; teams={z for x in g for z in (x["home"],x["away"])}
  previous=elo
  f=feature.get(year,{})
  good=[z for z in f.values() if z["covered"]]
  pivot=statistics.median((1-z["r"] for z in good)) if good else 0
  # Strength relative to independently calculated prior-year team Elo:
  # historical team-specific transfer origin cannot be established from
  # aggregate stats; this experiment uses only covered team features and
  # explicitly leaves unknown player-level origin unused.
  elo={t:1500+CARRY*(previous.get(t,1500)-1500)
       +(f[t]["minute_adj"]+quality*f[t]["q_centered"] if t in f and f[t]["covered"] else 0.)
       for t in teams}
  ll=bs=0.;n=0
  for day,batch in groupby(g,key=lambda x:x["day"]):
   changes=defaultdict(float)
   for x in batch:
    h,a=x["home"],x["away"];p=prob(elo[h],elo[a])
    y=float(x["home_score"]>x["away_score"])
    ll-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12));bs+=(p-y)**2;n+=1
    early=(day-g[0]["day"]).days<45
    turnover=sum(1-f[t]["r"]-pivot for t in (h,a) if t in f and f[t]["covered"])/2
    speed=max(.5,min(1.5,1+churn_gamma*turnover)) if early else 1.
    # Origin coefficient reserved here; source-school ratings have no
    # verified per-player membership in these historical feature records.
    # Do not pretend origin contributed to the historical trial.
    margin=abs(x["home_score"]-x["away_score"])
    delta=K*speed*(1+MOV*math.log10(1+margin))*(y-p)
    changes[h]+=delta;changes[a]-=delta
   for t,d in changes.items():elo[t]+=d
  reports[year]={"games":n,"log_loss":ll/n,"brier":bs/n}
 return reports

def calibrate(games,features):
 trials=[]
 for quality,churn in product(QUALITY,CHURN):
  # Origin deliberately zero until strict player-school historical joins.
  cfg=(quality,0.,churn)
  result=trial(games,features,cfg)
  n=sum(result[y]["games"] for y in (2024,2025))
  loss=sum(result[y]["log_loss"]*result[y]["games"] for y in (2024,2025))/n
  trials.append({"quality_beta":quality,"origin_beta":0.,"churn_gamma":churn,
                 "train_log_loss":loss,"diagnostic_2026":result[2026]})
 winner=min(trials,key=lambda x:(x["train_log_loss"],x["quality_beta"],x["churn_gamma"]))
 baseline=next(x for x in trials if x["quality_beta"]==0 and x["churn_gamma"]==0)
 return {"model":"ncaam-combined-elo-research-v1",
  "status":"RETROSPECTIVE_COMBINATION_NOT_PRESEASON_CERTIFIED",
  "train_years":[2024,2025],"reused_diagnostic_year":2026,
  "selected":{"quality_beta":winner["quality_beta"],"churn_gamma":winner["churn_gamma"],"origin_beta":0.},
  "diagnostic_baseline":baseline["diagnostic_2026"],
  "diagnostic_combined":winner["diagnostic_2026"],
  "better_both":winner["diagnostic_2026"]["log_loss"]<baseline["diagnostic_2026"]["log_loss"] and winner["diagnostic_2026"]["brier"]<baseline["diagnostic_2026"]["brier"],
  "transfers_origin_included_in_scoring":False,
  "transfer_origin_reason":"Missing verified player-to-previous-school join in historical seasonal features; no manufactured effect",
  "preseason_roster_asof_verified":False,
  "automatic_promotion":False,
  "limitations":["Roster membership may contain post-opening information",
                 "2026 reused for diagnostic after earlier inspection",
                 "No verified home/neutral venue labels",
                 "Incoming transfer source-strength feature has been withheld from historical scoring"],
  "trials":trials}

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--source",type=Path,required=True)
 ap.add_argument("--output",type=Path,default=Path("data/ncaam-combined-elo-research.json"))
 a=ap.parse_args();games={};feat={}
 for yr in (2023,2024,2025,2026):
  roster=read_gz(a.source,"team_rosters",yr)
  schools={school_key(x["team"]):str(x["team_id"]) for x in roster}
  games[yr],_=extract_games(read_gz(a.source,"schedule",yr),schools,read_gz(a.source,"player_box",yr))
  assert len(games[yr])>=3000
  if yr>=2024:feat[yr],_,_=preseason_features(roster,read_gz(a.source,"player_box",yr-1))
 result=calibrate(games,feat)
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({k:v for k,v in result.items() if k!="trials"},indent=2))
if __name__=="__main__":main()

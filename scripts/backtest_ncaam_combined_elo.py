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
from audit_ncaam_historical_transfer_origin import origin_features
from backtest_ncaam_quality_retrospective import unadjusted_end

CARRY=.65; K=24.; MOV=.55
# Explicit small comparison, not a claim of globally optimized parameters.
QUALITY=(0.,400.,1200.)
ORIGIN=(0.,10.,25.)
CHURN=(0.,.5,1.)

def trial(games,feature,config,source_strength):
 quality,origin,churn_gamma=config
 elo={}
 reports={}
 for year in (2023,2024,2025,2026):
  g=games[year]; teams={z for x in g for z in (x["home"],x["away"])}
  previous=elo
  f=feature.get(year,{})
  good=[z for z in f.values() if z["covered"]]
  pivot=statistics.median((1-z["r"] for z in good)) if good else 0
  elo={t:1500+CARRY*(previous.get(t,1500)-1500)
       +(f[t]["minute_adj"]+quality*f[t]["q_centered"]+origin*source_strength.get(year,{}).get(t,0.)
         if t in f and f[t]["covered"] else 0.)
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
    margin=abs(x["home_score"]-x["away_score"])
    delta=K*speed*(1+MOV*math.log10(1+margin))*(y-p)
    changes[h]+=delta;changes[a]-=delta
   for t,d in changes.items():elo[t]+=d
  reports[year]={"games":n,"log_loss":ll/n,"brier":bs/n}
 return reports

def calibrate(games,features,source_strength,source_audits):
 trials=[]
 for quality,churn,origin in product(QUALITY,CHURN,ORIGIN):
  cfg=(quality,origin,churn)
  result=trial(games,features,cfg,source_strength)
  n=sum(result[y]["games"] for y in (2024,2025))
  loss=sum(result[y]["log_loss"]*result[y]["games"] for y in (2024,2025))/n
  trials.append({"quality_beta":quality,"origin_beta":origin,"churn_gamma":churn,
                 "train_log_loss":loss,"diagnostic_2026":result[2026]})
 winner=min(trials,key=lambda x:(x["train_log_loss"],x["quality_beta"],x["churn_gamma"]))
 baseline=next(x for x in trials if x["quality_beta"]==0 and x["churn_gamma"]==0 and x["origin_beta"]==0)
 return {"model":"ncaam-combined-elo-research-v1",
  "status":"RETROSPECTIVE_COMBINATION_NOT_PRESEASON_CERTIFIED",
  "train_years":[2024,2025],"reused_diagnostic_year":2026,
  "selected":{"quality_beta":winner["quality_beta"],"churn_gamma":winner["churn_gamma"],"origin_beta":winner["origin_beta"]},
  "diagnostic_baseline":baseline["diagnostic_2026"],
  "diagnostic_combined":winner["diagnostic_2026"],
  "better_both":winner["diagnostic_2026"]["log_loss"]<baseline["diagnostic_2026"]["log_loss"] and winner["diagnostic_2026"]["brier"]<baseline["diagnostic_2026"]["brier"],
  "transfers_origin_included_in_scoring":True,
  "transfer_origin_selected_nonzero":winner["origin_beta"]!=0,
  "transfer_origin_evidence":"Unique exact historical player-name to previous school, minutes-weighted using independently replayed prior-year Elo",
  "transfer_origin_audits":source_audits,
  "preseason_roster_asof_verified":False,
  "automatic_promotion":False,
  "limitations":["Previous-school transfer identity is unique name matched, not verified cross-year athlete ID",
                 "Roster membership may contain post-opening information",
                 "2026 reused for diagnostic after earlier inspection",
                 "No verified home/neutral venue labels",
                 "Previous school not independently rated or unmatched athlete receives no source-strength value"],
  "trials":trials}

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--source",type=Path,required=True)
 ap.add_argument("--output",type=Path,default=Path("data/ncaam-combined-elo-research.json"))
 a=ap.parse_args();games={};feat={};strength={};source_audits={};prior_ratings={}
 for yr in (2023,2024,2025,2026):
  roster=read_gz(a.source,"team_rosters",yr)
  schools={school_key(x["team"]):str(x["team_id"]) for x in roster}
  games[yr],_=extract_games(read_gz(a.source,"schedule",yr),schools,read_gz(a.source,"player_box",yr))
  assert len(games[yr])>=3000
  if yr>=2024:
   old_box=read_gz(a.source,"player_box",yr-1)
   feat[yr],_,_=preseason_features(roster,old_box)
   joined,audit=origin_features(roster,old_box,prior_ratings)
   strength[yr]={row["destination"]:row["prior_school_elo_relative_to_1500"] for row in joined if row["prior_school_elo_relative_to_1500"] is not None}
   source_audits[str(yr)]=audit
  prior_ratings=unadjusted_end(games[yr],prior_ratings,schools)
 result=calibrate(games,feat,strength,source_audits)
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({k:v for k,v in result.items() if k!="trials"},indent=2))
if __name__=="__main__":main()

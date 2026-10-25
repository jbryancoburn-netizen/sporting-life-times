#!/usr/bin/env python3
"""Historical player-stat adjustment audit by evidence coverage and game timing.
All roster features retrospective. No production promotion.
"""
import json,math,statistics,argparse
from pathlib import Path
from collections import defaultdict
from itertools import groupby
from calibrate_ncaam_independent_stat_weights import data
from backtest_ncaam_combined_elo import CARRY,K,MOV
from backtest_ncaam_turnover_update_speed import prob

def analyze(games,feat,orig,multi,weights):
 prev={};results={}
 for year in (2023,2024,2025,2026):
  g=games[year];teams={t for x in g for t in (x["home"],x["away"])}
  f=feat.get(year,{})
  good=[x for x in f.values() if x["covered"]]
  pivot=statistics.median((1-x["r"] for x in good)) if good else 0
  base={t:1500+CARRY*(prev.get(t,1500)-1500)+
    (f[t]["minute_adj"]+1200*f[t]["q_centered"]+25*orig.get(year,{}).get(t,0.)
     if t in f and f[t]["covered"] else 0.) for t in teams}
  adjustment={t:sum(weights[k]*multi.get(year,{}).get(t,{}).get(k,0.) for k in weights)
   if t in f and f[t]["covered"] else 0. for t in teams}
  ratings={t:base[t]+adjustment[t] for t in teams};reference=base.copy()
  bins=defaultdict(lambda:{"n":0,"ll_adjusted":0.,"ll_reference":0.,"brier_adjusted":0.,"brier_reference":0.})
  for day,batch in groupby(g,key=lambda v:v["day"]):
   delta=defaultdict(float);delta0=defaultdict(float)
   for x in batch:
    h,a=x["home"],x["away"];y=float(x["home_score"]>x["away_score"])
    p=prob(ratings[h],ratings[a]);q=prob(reference[h],reference[a])
    if year>=2025:
     magnitude=max(abs(adjustment[h]),abs(adjustment[a]))
     high=magnitude>=70
     # Availability is measured by whether each team has a prior-season
     # roster-matched multistat feature; this is not true as-of verification.
     matched=sum(t in multi.get(year,{}) for t in (h,a))
     season_day=(day-g[0]["day"]).days
     part="early_0_44" if season_day<45 else "later_45_plus"
     key=("70_plus" if high else "under_70",part,str(matched)+"_teams_matched")
     b=bins[key];b["n"]+=1
     for suffix,v in (("adjusted",p),("reference",q)):
      b["ll_"+suffix]-=y*math.log(max(v,1e-12))+(1-y)*math.log(max(1-v,1e-12))
      b["brier_"+suffix]+=(v-y)**2
    turnover=sum(1-f[t]["r"]-pivot for t in (h,a) if t in f and f[t]["covered"])/2
    speed=max(.5,min(1.5,1+turnover)) if (day-g[0]["day"]).days<45 else 1.
    factor=K*speed*(1+MOV*math.log10(1+abs(x["home_score"]-x["away_score"])))
    da=factor*(y-p);db=factor*(y-q)
    delta[h]+=da;delta[a]-=da;delta0[h]+=db;delta0[a]-=db
   for t,d in delta.items():ratings[t]+=d
   for t,d in delta0.items():reference[t]+=d
  if year>=2025:
   results[str(year)]={"groups":[{"adjustment_group":key[0],"period":key[1],"matched_team_count":int(key[2][0]),"games":b["n"],
    **{k+"_mean":b[k]/b["n"] for k in ("ll_adjusted","ll_reference","brier_adjusted","brier_reference")}}
    for key,b in sorted(bins.items()) if b["n"]]}
  prev=ratings
 return {"model":"ncaam-stat-adjustment-coverage-timing-v1","status":"RETROSPECTIVE_RESEARCH_ONLY",
  "production_promotion_allowed":False,"results":results,
  "cautions":["Matched historical player name and roster is not validated as-of opening date",
             "Earlier seasons have been repeatedly inspected",
             "Reference comparison omits stat term but inherits earlier optimized ratings"]}
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
 p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-stat-adjustment-coverage-timing.json"))
 a=p.parse_args();g,f,o,m=data(a.source)
 w=json.loads(Path("data/ncaam-continuous-stat-optimizer.json").read_text())["selected_weights"]
 d=analyze(g,f,o,m,w);a.out.parent.mkdir(parents=True,exist_ok=True)
 a.out.write_text(json.dumps(d,indent=2)+"\n")
 print(json.dumps(d,indent=2))

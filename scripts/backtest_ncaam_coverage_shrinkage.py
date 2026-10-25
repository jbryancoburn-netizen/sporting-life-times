#!/usr/bin/env python3
"""Research-only replay of continuous stat Elo with evidence-coverage shrinkage."""
import argparse,json,math,statistics
from pathlib import Path
from collections import defaultdict
from itertools import groupby
from calibrate_ncaam_independent_stat_weights import data
from audit_ncaam_stat_player_match_coverage import evidence
from backtest_ncaam_quality_retrospective import read_gz
from backtest_ncaam_combined_elo import CARRY,K,MOV
from backtest_ncaam_turnover_update_speed import prob

# Learned strength, not arbitrary hard-coded eligibility cutoffs.
STRENGTHS=(0.,.25,.5,1.,2.)
def replay(games,feat,orig,multi,coverage,weights,strength):
 prev={};result={}
 for yr in (2023,2024,2025,2026):
  g=games[yr];teams={t for r in g for t in (r["home"],r["away"])}
  f=feat.get(yr,{})
  good=[a for a in f.values() if a["covered"]]
  pivot=statistics.median((1-a["r"] for a in good)) if good else 0.
  start={}
  for t in teams:
   x=f.get(t,{})
   base=1500+CARRY*(prev.get(t,1500)-1500)
   if x.get("covered"):
    base+=x["minute_adj"]+1200*x["q_centered"]+25*orig.get(yr,{}).get(t,0.)
    adjustment=sum(weights[k]*multi.get(yr,{}).get(t,{}).get(k,0.) for k in weights)
    cov=coverage.get(yr,{}).get(t,{})
    fraction=cov.get("matched_roster_fraction",0.)
    # Smooth shrinkage from full effect at strength zero.
    adjustment*=1/(1+strength*(1-fraction))
    base+=adjustment
   start[t]=base
  elo=start;loss=brier=0.;n=0
  for day,batch in groupby(g,key=lambda a:a["day"]):
   delta=defaultdict(float)
   for r in batch:
    h,a=r["home"],r["away"];p=prob(elo[h],elo[a]);y=float(r["home_score"]>r["away_score"])
    loss-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12))
    brier+=(p-y)**2;n+=1
    turnover=sum(1-f[t]["r"]-pivot for t in (h,a) if t in f and f[t]["covered"])/2
    speed=max(.5,min(1.5,1+turnover)) if (day-g[0]["day"]).days<45 else 1.
    k=K*speed*(1+MOV*math.log10(1+abs(r["home_score"]-r["away_score"])))
    change=k*(y-p);delta[h]+=change;delta[a]-=change
   for t,v in delta.items():elo[t]+=v
  result[yr]={"games":n,"log_loss":loss/n,"brier":brier/n}
  prev=elo
 return result

def main():
 ap=argparse.ArgumentParser();ap.add_argument("--source",type=Path,required=True)
 ap.add_argument("--out",type=Path,default=Path("historical-report/ncaam-coverage-shrinkage.json"))
 a=ap.parse_args();games,feat,orig,multi=data(a.source)
 weights=json.loads(Path("data/ncaam-continuous-stat-optimizer.json").read_text())["selected_weights"]
 coverage={y:evidence(read_gz(a.source,"team_rosters",y),read_gz(a.source,"player_box",y-1)) for y in (2024,2025,2026)}
 rows=[]
 for strength in STRENGTHS:
  r=replay(games,feat,orig,multi,coverage,weights,strength)
  rows.append({"strength":strength,"train_2024":r[2024],"validation_2025":r[2025],"reused_2026":r[2026]})
 selected=min(rows,key=lambda x:(x["train_2024"]["log_loss"],x["strength"]))
 baseline=rows[0]
 d={"model":"ncaam-coverage-dependent-player-stat-shrinkage-v1",
   "selection_year":2024,"previously_inspected_validation_year":2025,"reused_diagnostic_year":2026,
   "selected_strength":selected["strength"],"selected_validation_2025":selected["validation_2025"],
   "unshrunk_validation_2025":baseline["validation_2025"],
   "selected_reused_2026":selected["reused_2026"],"unshrunk_reused_2026":baseline["reused_2026"],
   "method":"coefficient_multiplier 1/(1+strength*(1-matched_roster_fraction))",
   "roster_asof_certified":False,"production_promotion_allowed":False,
   "limitations":["Unique name matching is not verified athlete ID","Historical roster membership is retrospectively assembled",
      "2025 and 2026 previously inspected; model terms other than strength previously calibrated"],
   "trials":rows}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(d,indent=2)+"\n")
 print(json.dumps({k:v for k,v in d.items() if k!="trials"},indent=2))
if __name__=="__main__":main()

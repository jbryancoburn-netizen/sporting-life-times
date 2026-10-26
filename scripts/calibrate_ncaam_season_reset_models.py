#!/usr/bin/env python3
"""Re-fit three NCAA preseason initialization strategies on identical historical games.
2024-25 calibration only; 2026 untouched diagnostic. Historical archived roster
availability before season start remains UNVERIFIED; no automatic Elo promotion.
"""
import argparse,json,math,statistics
from collections import defaultdict
from itertools import groupby,product
from pathlib import Path
from backtest_ncaam_quality_retrospective import read_gz,extract_games,school_key,preseason_features,update_date_batch,logistic,unadjusted_end
YEARS=(2023,2024,2025,2026)
BETA_RET=(0.,120.,240.)
BETA_TRANSFER=(0.,160.,320.)
BETA_QUALITY=(0.,200.,400.,800.)
MODES=("carryover","reset","continuity")
def measure(games,previous,features,mode,br,bt,bq):
 years={}
 for y in YEARS:
  g=games[y];teams={t for row in g for t in (row["home"],row["away"])}
  fs=features.get(y,{})
  covered=[v for v in fs.values() if v["covered"]]
  mr=statistics.median(v["r"] for v in covered) if covered else 0.
  mt=statistics.median(v["t"] for v in covered) if covered else 0.
  prev=previous.get(y-1,{})
  rating={}
  for t in teams:
   f=fs.get(t);r=f["r"] if f and f["covered"] else 0.
   prior_term={"carryover":.65,"reset":0.,"continuity":max(0.,min(1.,r))}[mode]*(prev.get(t,1500)-1500)
   adj=(br*(r-mr)+bt*(f["t"]-mt)+bq*f["q_centered"]) if f and f["covered"] else 0.
   rating[t]=1500+prior_term+adj
  ll=bs=0.;n=0
  start=g[0]["day"]
  for day,it in groupby(g,key=lambda x:x["day"]):
   batch=list(it)
   if (day-start).days<45 and y>2023:
    for row in batch:
     h,a=row["home"],row["away"]
     if h not in rating or a not in rating:continue
     p=max(1e-12,min(1-1e-12,logistic(rating[h]-rating[a])))
     actual=float(row["home_score"]>row["away_score"])
     ll-=actual*math.log(p)+(1-actual)*math.log(1-p)
     bs+=(p-actual)**2;n+=1
   update_date_batch(rating,batch)
  if y>2023:years[str(y)]={"games":n,"log_loss":ll/n,"brier":bs/n}
 return years
def main():
 parser=argparse.ArgumentParser();parser.add_argument("--source",type=Path,required=True)
 parser.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-reset-continuity-calibration.json"));args=parser.parse_args()
 games={};features={};prev={}
 for y in YEARS:
  roster=read_gz(args.source,"team_rosters",y)
  box=read_gz(args.source,"player_box",y)
  # Verified NCAA team ID via actual player box concordance.
  programs_by_name=defaultdict(set)
  for x in box:
   name=school_key(x.get("team"));tid=str(x.get("team_ncaa_team_id") or "")
   if name and tid:programs_by_name[name].add(tid)
  programs={t:next(iter(ids)) for t,ids in programs_by_name.items() if len(ids)==1}
  games[y],_=extract_games(read_gz(args.source,"schedule",y),programs,box)
  if len(games[y])<5000:raise ValueError("Incomplete NCAA game population "+str(y))
  if y>2023:features[y],_,_=preseason_features(roster,read_gz(args.source,"player_box",y-1))
  prev[y]=unadjusted_end(games[y],prev.get(y-1,{}),programs)
 out=[]
 for mode in MODES:
  trials=[]
  for br,bt,bq in product(BETA_RET,BETA_TRANSFER,BETA_QUALITY):
   seasons=measure(games,prev,features,mode,br,bt,bq)
   if seasons["2024"]["games"]<1000 or seasons["2025"]["games"]<1000:raise ValueError("Insufficient training games")
   train_n=sum(seasons[str(y)]["games"] for y in (2024,2025))
   train_loss=sum(seasons[str(y)]["games"]*seasons[str(y)]["log_loss"] for y in (2024,2025))/train_n
   trials.append({"returning_beta":br,"transfer_beta":bt,"quality_beta":bq,"train_games":train_n,
      "train_log_loss":train_loss,"diagnostic_2026":seasons["2026"]})
  # No 2026 diagnostic results influence selection.
  best=min(trials,key=lambda x:(x["train_log_loss"],x["returning_beta"]+x["transfer_beta"]+x["quality_beta"]))
  out.append({"mode":mode,"selected":best,"trials":trials,"grid_size":len(trials)})
 result={"model":"slat-2026-27-season-start-recalibration-v1","status":"HISTORICAL_RETROSPECTIVE_NOT_PRESEASON_ASOF_CERTIFIED",
  "training_seasons":[2024,2025],"untouched_diagnostic_season":2026,
  "evaluation_period":"first 45 calendar days each season",
  "same_games_for_all_models":True,"season_games":{str(y):len(games[y]) for y in YEARS},
  "modes":out,"winner_on_2026_diagnostic":min(out,key=lambda x:x["selected"]["diagnostic_2026"]["log_loss"])["mode"],
  "automatic_promotion":False,"limitations":["Archived roster membership may reflect end-of-season players instead of actual pre-opening-day rosters",
    "2026 was inspected in earlier experiments, so not pristine prospective validation",
    "Grid is bounded; optimum may lie beyond candidate coefficients",
    "No verified coaching change, recruit projection or true game venue"],
  "note":"Each strategy's player coefficients are independently selected using 2024-25 games only."}
 args.out.parent.mkdir(parents=True,exist_ok=True)
 args.out.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps([{"mode":m["mode"],"selected":m["selected"]} for m in out],indent=2))
if __name__=="__main__":main()

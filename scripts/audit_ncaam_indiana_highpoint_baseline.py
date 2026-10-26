#!/usr/bin/env python3
"""Independent season replay audit for Indiana and High Point baseline Elo.
Read real NCAA schedules and player-box IDs, compute pregame strength and
Elo movement from the established K=24, MOV=.55, 65% offseason carryover.
Do not silently certify parity with a separately published baseline.
"""
import argparse,json,statistics
from pathlib import Path
from itertools import groupby
from backtest_ncaam_quality_retrospective import read_gz,school_key,extract_games,update_date_batch,logistic,K,MOV,CARRYOVER
from collections import defaultdict
import math
TARGETS={"indiana","high point"}
def replay(root,reference):
 prior={};years={};expected={}
 for season in (2023,2024,2025,2026):
  rosters=read_gz(root,"team_rosters",season);boxes=read_gz(root,"player_box",season)
  programs={school_key(x.get("team")):str(x["team_id"]) for x in rosters if x.get("team") and x.get("team_id")}
  games,excluded=extract_games(read_gz(root,"schedule",season),programs,boxes)
  if len(games)<3000:raise ValueError(f"Incomplete real game ledger {season}: {len(games)}")
  ratings={team:1500+CARRYOVER*(prior.get(team,1500)-1500) for team in programs}
  ledger={team:[] for team in TARGETS}
  for day,iterator in groupby(games,key=lambda g:g["day"]):
   batch=list(iterator)
   for g in batch:
    h,a=g["home"],g["away"]
    if h not in ratings or a not in ratings:continue
    diff=ratings[h]-ratings[a];pr=logistic(diff);margin=abs(g["home_score"]-g["away_score"])
    mult=1+MOV*math.log1p(margin)/math.log(10)
    delta=K*mult*((1 if g["home_score"]>g["away_score"] else 0)-pr)
    for t,o,actual,pregame,shift,own,opponent,venue in [
     (h,a,g["home_score"]>g["away_score"],pr,delta,g["home_score"],g["away_score"],"home"),
     (a,h,g["away_score"]>g["home_score"],1-pr,-delta,g["away_score"],g["home_score"],"away")]:
     if t in TARGETS:
      ledger[t].append({"date":day.isoformat(),"opponent":o,"opponent_pregame_elo":round(ratings[o],2),
       "team_pregame_elo":round(ratings[t],2),"venue":venue,"score":f"{int(own)}-{int(opponent)}",
       "win":bool(actual),"expected_win_probability":round(pregame,4),"elo_change":round(shift,3),
       "margin":round(own-opponent,1)})
   update_date_batch(ratings,batch)
  years[str(season)]={"games_replayed":len(games),"excluded":excluded,"teams":{}}
  for name in TARGETS:
   rows=ledger[name]
   years[str(season)]["teams"][name]={"start_elo":round(1500+CARRYOVER*(prior.get(name,1500)-1500),4),
    "final_elo":round(ratings.get(name,1500),4),"games":len(rows),"wins":sum(r["win"] for r in rows),
    "opponent_pregame_mean_elo":round(statistics.mean(r["opponent_pregame_elo"] for r in rows),2) if rows else None,
    "victories_over_1600_opponents":sum(r["win"] and r["opponent_pregame_elo"]>=1600 for r in rows),
    "net_elo_change":round(sum(r["elo_change"] for r in rows),3),
    "match_ledger":rows if season==2026 else []}
  prior=ratings
  if season==2026:
   for name in TARGETS:
    rank=reference[name];actual=ratings.get(name)
    expected[name]={"published_2026_27_base_elo":rank["base_elo"],"independent_2026_final_elo":round(actual,4) if actual is not None else None,
     "difference":round(actual-rank["base_elo"],4) if actual is not None else None,
     "parity_within_0_01":abs(actual-rank["base_elo"])<=.01 if actual is not None else False}
 return {"model":"ncaam-2026-baseline-elo-audit-v1","status":"REPLAY_VERIFIED_ONLY_IF_SOURCE_VALIDATED",
  "venue_adjustment_used":False,"source":"NCAA historical game schedules verified against NCAA player box contest/team identifiers",
  "parameters":{"k":K,"margin_weight":MOV,"carryover":CARRYOVER},
  "years":years,"published_baseline_comparison":expected,
  "warning":"Published preseason base Elo may use different priors, season coverage or identity mapping; differences are diagnostics, not automatic corrections."}
def main():
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,default=Path("historical-normalized"))
 p.add_argument("--output",type=Path,default=Path("data/ncaam-indiana-high-point-baseline-audit.json"));a=p.parse_args()
 ref=json.loads(Path("data/ncaam-2026-27-preseason-player-quality-live.json").read_text())
 teams={school_key(t["team"]):t for t in ref["rankings"] if school_key(t["team"]) in TARGETS}
 assert set(teams)==TARGETS
 d=replay(a.source,teams);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(d,indent=2)+"\n")
 print(json.dumps(d["published_baseline_comparison"],indent=2))
if __name__=="__main__":main()

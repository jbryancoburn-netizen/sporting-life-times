#!/usr/bin/env python3
"""Historical NCAA Elo backtest coverage gates (1892 onward).
Require documented season-level data completeness before computing or comparing
models; games-only eras must never be scored as player-augmented head-to-head.
"""
import argparse,csv,json
from collections import defaultdict
from pathlib import Path
def classify(row):
 games=int(row["verified_games"]);box=int(row["verified_player_box_games"]);rosters=int(row["verified_preopening_roster_teams"])
 nteams=int(row["verified_teams"])
 if games<max(500,int(nteams*8)):return "INSUFFICIENT_GAMES"
 if box>=int(games*.8) and rosters>=int(nteams*.9):return "FULL_PLAYER_H2H_ELIGIBLE"
 return "GAME_RESULTS_ELO_ONLY"
def main():
 p=argparse.ArgumentParser();p.add_argument("--manifest",type=Path,required=True);p.add_argument("--output",type=Path,default=Path("data/ncaam-century-backtest-coverage.json"));a=p.parse_args()
 rows=list(csv.DictReader(a.manifest.open()))
 years=[int(x["season"]) for x in rows]
 if len(years)!=len(set(years)):raise ValueError("duplicate season")
 if any(y<1892 or y>2026 for y in years):raise ValueError("outside approved historical range")
 result=[]
 for row in rows:
  level=classify(row)
  result.append({"season":int(row["season"]),"verified_games":int(row["verified_games"]),"verified_teams":int(row["verified_teams"]),
    "verified_player_box_games":int(row["verified_player_box_games"]),"verified_preopening_roster_teams":int(row["verified_preopening_roster_teams"]),
    "source":row["source"],"verification":row["verification"],"comparison_tier":level})
 out={"model":"NCAA historical century benchmark evidence coverage",
      "status":"SOURCE_COVERAGE_AUDIT_NOT_A_MODEL_BACKTEST",
      "target_start_season":1892,"target_end_season":2026,
      "full_player_comparison_requires":"At least 80% game-level player boxes and independently verified preseason rosters for at least 90% of teams",
      "game_only_warning":"Game score replay can compare Elo update rules, but cannot certify models that need player and transfer features.",
      "seasons":result,"eligible_full_player_seasons":[x["season"] for x in result if x["comparison_tier"]=="FULL_PLAYER_H2H_ELIGIBLE"],
      "eligible_score_only_seasons":[x["season"] for x in result if x["comparison_tier"]=="GAME_RESULTS_ELO_ONLY"]}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,indent=2)+"\n")
 print(json.dumps({"seasons_checked":len(result),"full_player_eligible":out["eligible_full_player_seasons"]},indent=2))
if __name__=="__main__":main()

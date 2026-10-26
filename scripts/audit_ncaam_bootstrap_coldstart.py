#!/usr/bin/env python3
"""Test whether cold-start vs multiyear initialization explains NCAA bootstrap differences."""
import json,argparse
from pathlib import Path
from itertools import groupby
from backtest_ncaam_quality_retrospective import read_gz,school_key,extract_games,update_date_batch
def main():
 p=argparse.ArgumentParser();p.add_argument("--source",default="historical-normalized");a=p.parse_args()
 prior=json.loads(Path("data/ncaam-indiana-high-point-baseline-audit.json").read_text())
 published=json.loads(Path("data/ncaam-2026-27-preseason-provisional.json").read_text())
 boxes=read_gz(a.source,"player_box",2026);roster=read_gz(a.source,"team_rosters",2026)
 programs={school_key(x["team"]):str(x["team_id"]) for x in roster if x.get("team") and x.get("team_id")}
 games,_=extract_games(read_gz(a.source,"schedule",2026),programs,boxes)
 if len(games)<5000:raise ValueError("Incomplete historical source")
 rating={x:1500. for x in programs}
 for _,batch in groupby(games,key=lambda g:g["day"]):update_date_batch(rating,list(batch))
 refs={school_key(x["team"]):x for x in published["rankings"]}
 rows={}
 for t in ("indiana","high point"):
  old=refs[t]["last_season_elo"];multi=prior["years"]["2026"]["teams"][t]["final_elo"]
  rows[t]={"published_final":old,"cold_start_final":round(rating[t],4),"multiyear_final":multi,
   "cold_start_error":round(rating[t]-old,4),"multiyear_error":round(multi-old,4)}
 result={"model":"same-game-coldstart-vs-multiyear-replay","season":2026,"verified_games":len(games),"research_only":True,"teams":rows}
 Path("data/ncaam-bootstrap-initialization-comparison.json").write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps(result,indent=2))
if __name__=="__main__":main()

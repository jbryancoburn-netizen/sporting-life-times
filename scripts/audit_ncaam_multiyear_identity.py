#!/usr/bin/env python3
"""Count roster players recovered from two prior seasons, no fabricated freshman labels."""
import argparse,json
from pathlib import Path
from backtest_ncaam_quality_retrospective import read_gz,player_key,school_key
from reconcile_ncaam_players import reconcile
from reconcile_ncaam_multi_year import reconcile_history
def main():
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True);p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-multiyear-identity-audit.json"))
 a=p.parse_args();results={}
 for year in (2025,2026):
  roster=read_gz(a.source,"team_rosters",year)
  immediate,_,_=reconcile(roster,read_gz(a.source,"player_box",year-1))
  known,counts=reconcile_history(roster,{year-1:read_gz(a.source,"player_box",year-1),year-2:read_gz(a.source,"player_box",year-2)})
  recovered=[{"team":k[0],"player_key":k[1],**v} for k,v in known.items() if k not in immediate]
  assert all(r["prior_year"]==year-2 for r in recovered)
  results[str(year)]={"current_roster_entries_accounted":sum(counts.values()),"immediate_prior_matches":len(immediate),
    "additional_previous_two_seasons_matches":len(recovered),"still_without_verified_prior_college_history":counts["no_verified_history_in_available_seasons"],
    "recovered_players":sorted(recovered,key=lambda x:(x["team"],x["player_key"]))}
 result={"method":"Unique-name safe join in previous one or two seasons","no_cross_season_id_assumed_stable":True,
  "roster_asof_preseason_verified":False,"production_promotion_allowed":False,"results":results}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({y:{k:v for k,v in d.items() if k!="recovered_players"} for y,d in results.items()},indent=2))
if __name__=="__main__":main()

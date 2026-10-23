#!/usr/bin/env python3
"""Compare verified roster snapshots without inventing player values or Elo.

Player-level moves require stable IDs across seasons. Avoids name-only joins.
"""
import argparse,json
from collections import defaultdict
from pathlib import Path
def analyze(old,new):
    oldteams={x["ncaa_id"]:x for x in old["rosters"]}
    newteams={x["ncaa_id"]:x for x in new["rosters"]}
    old_player_team=defaultdict(set)
    for team,roster in oldteams.items():
        for p in roster["players"]:old_player_team[p["id"]].add(team)
    results=[]
    for team,roster in sorted(newteams.items()):
        current={p["id"] for p in roster["players"]}
        last={p["id"] for p in oldteams.get(team,{}).get("players",[])}
        retained=current & last;incoming=current-last;departed=last-current
        transfers=[i for i in incoming if i in old_player_team and team not in old_player_team[i]]
        results.append({"team_id":team,"team":roster["school"],"roster_count":len(current),
           "prior_roster_count":len(last),"returning_players":len(retained),
           "incoming_players":len(incoming),"departed_players":len(departed),
           "confirmed_incoming_transfer_ids":sorted(transfers),
           "player_retention_share":round(len(retained)/len(last),4) if last else None,
           "coverage":"observed roster comparison only; no performance weighting"})
    return {"seasons":[old["season"],new["season"]],"roster_comparisons":results,
      "teams_with_both_seasons":sum(t["prior_roster_count"]>=8 for t in results),
      "teams_with_current_season":len(results),
      "elo_adjustment_ready":False,
      "reason":"Minutes-weighted returning production and historically calibrated team impact still required"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--old",type=Path,required=True)
    p.add_argument("--new",type=Path,required=True)
    p.add_argument("--out",type=Path,default=Path("staging/ncaam-roster-continuity.json"))
    a=p.parse_args()
    out=analyze(json.loads(a.old.read_text()),json.loads(a.new.read_text()))
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(out,indent=2)+"\n")
    print("Two-season roster coverage",out["teams_with_both_seasons"],"/",out["teams_with_current_season"])
if __name__=="__main__":main()

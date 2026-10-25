#!/usr/bin/env python3
"""Evaluate reintroducing correctly identified two-year-old player box data.

Train selection on 2025, report 2026 as previously inspected diagnostic only.
No production promotion. Older records are never presumed recent.
"""
import argparse,json
from pathlib import Path
from collections import defaultdict
from calibrate_ncaam_independent_stat_weights import data,score,FEATURES
from backtest_ncaam_quality_retrospective import read_gz,player_key,school_key
from reconcile_ncaam_players import reconcile
from reconcile_ncaam_multi_year import reconcile_history
from build_ncaam_historical_multistat_features import multistat_features

def old_player_stats(root,year):
 roster=read_gz(root,"team_rosters",year)
 recent=read_gz(root,"player_box",year-1)
 earlier=read_gz(root,"player_box",year-2)
 already,_,_=reconcile(roster,recent)
 history,_=reconcile_history(roster,{year-1:recent,year-2:earlier})
 recovered={key for key,v in history.items() if key not in already and v["prior_year"]==year-2}
 names={key[1] for key in recovered}
 # Require unique individual identity in earlier source, and no same-name
 # immediate-season box record (including other schools).
 recent_names={player_key(x.get("player")) for x in recent}
 safe=names-recent_names
 eligible={key for key in recovered if key[1] in safe}
 school_by_name=defaultdict(set)
 for r in earlier:
  n=player_key(r.get("player"))
  if n in safe:school_by_name[n].add(school_key(r.get("team")))
 safe={n for n in safe if len(school_by_name[n])==1}
 selected=[r for r in earlier if player_key(r.get("player")) in safe]
 if not selected:return None,{"recovered_roster_entries":len(recovered),"usable_names":0}
 added=set(player_key(r.get("player")) for r in selected)
 by_team,meta=multistat_features(roster,recent+selected)
 return by_team,{"recovered_roster_entries":len(recovered),
    "usable_names":len(added),"extra_box_rows":len(selected),
    "selection_uses_verified_athlete_id":False,
    "roster_asof_verified":False}
def main():
 p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
 p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-two-year-stat-recovery-backtest.json"))
 a=p.parse_args()
 games,feat,origin,multi=data(a.source)
 optimized=json.loads(Path("data/ncaam-continuous-stat-optimizer.json").read_text())["selected_weights"]
 weights=[optimized[k] for k in FEATURES]
 additional={};audit={}
 for y in (2025,2026):
  add,details=old_player_stats(a.source,y)
  additional[y]=add or multi[y]
  audit[str(y)]=details
 rows=[]
 for factor in (0.,.25,.5,1.):
  current=dict(multi)
  for y in (2025,2026):
   current[y]={}
   for team,baseline in multi[y].items():
    updated=additional[y].get(team,baseline)
    current[y][team]={k:baseline[k]+factor*(updated.get(k,baseline[k])-baseline[k]) for k in FEATURES}
  r=score(games,feat,origin,current,weights)
  rows.append({"historical_recovery_influence":factor,"training_2025":r[2025],"previously_inspected_2026":r[2026]})
 selected=min(rows,key=lambda x:(x["training_2025"]["log_loss"],x["historical_recovery_influence"]))
 output={"experiment":"two-year-historical-player-stats-influence",
 "training_selection_year":2025,"reused_diagnostic_year":2026,
 "baseline":{"training_2025":rows[0]["training_2025"],"reused_2026":rows[0]["previously_inspected_2026"]},
 "selected":selected,"source_recovery":audit,
 "preserves_original_rating_until_verified":True,"production_promotion_allowed":False,
 "historical_roster_asof_verified":False,
 "limitations":["2025 model parameters previously inspected","2026 is repeatedly inspected diagnostic",
 "Cross-season identifiers not certified; unique names only","No trustworthy offseason opening-day roster timestamps",
 "This tests reusing stale statistics and does not certify actual player identity"],
 "trials":rows}
 a.out.parent.mkdir(parents=True,exist_ok=True)
 a.out.write_text(json.dumps(output,indent=2)+"\n")
 print(json.dumps({"recovery":audit,"selected":selected,"baseline":output["baseline"]},indent=2))
if __name__=="__main__":main()

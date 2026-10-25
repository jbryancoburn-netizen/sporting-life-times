#!/usr/bin/env python3
"""Account for every NCAA historical roster player; do not call unknown a freshman."""
import argparse,json
from pathlib import Path
from backtest_ncaam_quality_retrospective import read_gz
from reconcile_ncaam_players import reconcile
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True)
 p.add_argument('--out',type=Path,default=Path('historical-report/ncaam-player-reconciliation.json'))
 a=p.parse_args();seasons={}
 for yr in (2024,2025,2026):
  matches,counts,details=reconcile(read_gz(a.source,'team_rosters',yr),read_gz(a.source,'player_box',yr-1))
  by_school={}
  for r in details:
   t=r['team'];slot=by_school.setdefault(t,{'players_accounted_for':0,'matched':0,'ambiguous':0,'no_previous_box_evidence':0})
   slot['players_accounted_for']+=1
   k=r['matching_status']
   if k.startswith('matched'):slot['matched']+=1
   elif k.startswith('ambiguous'):slot['ambiguous']+=1
   else:slot['no_previous_box_evidence']+=1
  assert sum(counts.values())==len(details)
  seasons[str(yr)]={'players_accounted_for':len(details),'match_reason_counts':counts,
   'team_counts':by_school,'unmatched_player_records':[r for r in details if not r['matching_status'].startswith('matched')],
   'id_join_requires_name_agreement':True,'freshman_identification_claimed':False}
 result={'model':'ncaam-player-reconciliation-v1','roster_asof_preseason_certified':False,
  'cross_season_athlete_id_stability_verified':False,
  'production_promotion_allowed':False,
  'scope':'Historical roster vs immediately prior season; unknown is not equivalent to freshman',
  'seasons':seasons}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({y:{'players_accounted_for':v['players_accounted_for'],'counts':v['match_reason_counts']} for y,v in seasons.items()},indent=2))
if __name__=='__main__':main()

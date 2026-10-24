#!/usr/bin/env python3
"""Reconcile captured NBA statistics without claiming official full-season coverage."""
import json
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 read=lambda name:json.loads((ROOT/'data'/name).read_text())
 archive=read('nba-game-center.json');elo=read('nba-2026-27-current-provisional.json');published=read('nba-player-leaders.json')
 fields='pts reb ast stl blk tov fgm fga fg3m fg3a ftm fta'.split()
 aggregate=defaultdict(lambda:dict.fromkeys(['gp']+fields,0));issues=[];ids=set();lines=0
 finals=[g for g in archive['games'] if g.get('state')=='post']
 for g in finals:
  if g['id'] in ids:issues.append('duplicate_game:'+g['id'])
  ids.add(g['id']);seen=set()
  if not g.get('players'):issues.append('missing_player_box:'+g['id'])
  for p in g.get('players',[]):
   key=(str(p['id']),p['team']);lines+=1
   if key in seen:issues.append('duplicate_player:'+g['id']+':'+str(key))
   seen.add(key);aggregate[key]['gp']+=1
   for f in fields:aggregate[key][f]+=p.get(f,0)
  for t in g.get('teams',[]):
   total=sum(p.get('pts',0) for p in g.get('players',[]) if p.get('team')==t['code'])
   if total!=int(t['score']):issues.append('player_points_do_not_match_final:'+g['id']+':'+t['code'])
 rows={(str(p['id']),p['team']):p for p in published['season_totals']}
 if set(rows)!=set(aggregate):issues.append('season_player_set_mismatch')
 for key,totals in aggregate.items():
  for field,value in totals.items():
   if rows.get(key,{}).get(field)!=value:issues.append('season_total_mismatch:'+str(key)+':'+field)
 ledger={g['id'] for g in elo['events']}
 if ledger!=ids:issues.append('elo_archive_game_set_mismatch')
 report={'status':'pass_captured_sample' if not issues else 'attention','games':len(finals),'player_lines':lines,'player_team_records':len(rows),'missing_quarter_scores':sum(not g.get('period_scores') for g in finals),'missing_team_comparisons':sum(not g.get('team_comparison') for g in finals),'missing_possession_counts':sum(not g.get('possession_stats') for g in finals),'issues':issues,'scope':'Captured regular-season games only; official league-wide completeness is not independently certified.','advanced_stats':'Published season aggregates include shooting percentages and true shooting; full advanced-stat coverage is not certified.'}
 (ROOT/'data/nba-stat-coverage-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if issues:raise SystemExit(1)
if __name__=='__main__':main()

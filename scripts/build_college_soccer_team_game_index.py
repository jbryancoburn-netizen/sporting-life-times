#!/usr/bin/env python3
"""Build NCAA soccer team fixture indexes from immutable forecast and official final ledgers.
Never claim full-season coverage from incremental game feeds.
"""
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
def load(name):return json.loads((root/'data'/name).read_text())
elo=load('college-soccer-elo.json')
ledger=load('college-soccer-elo-final-ledger.json')
archive=load('college-soccer-prospective-v2.json')
lookup=defaultdict(set)
for cohort,rows in elo['cohorts'].items():
    gender=cohort.split('-')[0]
    for team in rows:lookup[(gender,team['team_id'])].add(cohort)
by_match={}
for final in ledger['results']:
    key=final['match_id']
    if key in by_match and by_match[key]!=final:raise ValueError('Conflicting official finals: '+key)
    by_match[key]=final
teams=defaultdict(dict)
unresolved=[]
for final in by_match.values():
    for home in (True,False):
        name=final['home_team'] if home else final['away_team']
        division=lookup[(final['gender'],name)]
        if len(division)!=1:
            unresolved.append({'match_id':final['match_id'],'team_id':name,'reason':'ambiguous_or_missing_division'})
            continue
        cohort=next(iter(division))
        key=cohort+':'+name
        opponent=final['away_team'] if home else final['home_team']
        teams[key][final['match_id']]={
            'match_id':final['match_id'],'date':final['date'],'opponent':opponent,
            'venue':'home' if home else 'away','status':'final',
            'goals_for':final['home_goals'] if home else final['away_goals'],
            'goals_against':final['away_goals'] if home else final['home_goals'],
            'source_url':final.get('source_game'),'source_type':'verified_official_final'
        }
for forecast in archive['forecasts']:
    match_id=forecast['match_id']
    if match_id in by_match:continue
    for home in (True,False):
        name=forecast['home_team'] if home else forecast['away_team']
        key=forecast['cohort']+':'+name
        if key not in {c+':'+name for c in lookup[(forecast['cohort'].split('-')[0],name)]}:
            unresolved.append({'match_id':match_id,'team_id':name,'reason':'forecast_team_missing_in_rankings'})
            continue
        teams[key][match_id]={
            'match_id':match_id,'date':forecast['kickoff_utc'][:10],
            'kickoff_utc':forecast['kickoff_utc'],
            'opponent':forecast['away_name'] if home else forecast['home_name'],
            'venue':'home' if home else 'away',
            'status':'unverified','goals_for':None,'goals_against':None,
            'source_url':forecast.get('source_game'),
            'source_type':'timestamped_pregame_forecast'
        }
payload={
 'schema_version':1,
 'generated_at':datetime.now(timezone.utc).isoformat(),
 'coverage':'partial_verified_finals_plus_locked_forecasts',
 'notice':'Partial schedule index only: official final ledger begins after the pinned baseline; pending fixtures are unverified until official finals arrive. A scheduled game may have already started.',
 'verified_final_count':len(by_match),
 'locked_forecast_count':len(archive['forecasts']),
 'unresolved':unresolved,
 'teams':{key:{'games':sorted(records.values(),key=lambda g:(g['date'],g['match_id']))}
          for key,records in sorted(teams.items())}
}
out=root/'data/college-soccer-team-game-index.json'
out.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n')
print('Team game index:',len(teams),'teams,',len(by_match),'finals,',len(unresolved),'unresolved identities')

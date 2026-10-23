#!/usr/bin/env python3
"""Fail on structural publication errors; report stale/missing providers without fabrication."""
import json,datetime,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
UTC=datetime.timezone.utc
def read(path):
 try:return json.loads((ROOT/path).read_text(encoding='utf-8'))
 except (OSError,ValueError):return None
def age_hours(stamp,now):
 try:return round((now-datetime.datetime.fromisoformat(stamp.replace('Z','+00:00'))).total_seconds()/3600,2)
 except (AttributeError,TypeError,ValueError):return None
def audit(now=None):
 now=now or datetime.datetime.now(UTC)
 failures=[];warnings=[];leagues=[]
 data=read('multi_scoreboards.json')
 if not data or not isinstance(data.get('leagues'),list):
  failures.append('missing or invalid multi_scoreboards.json')
 else:
  age=age_hours(data.get('updated_at'),now)
  if age is None or age>3:warnings.append('published scoreboard snapshot is stale or undated')
  for block in data['leagues']:
   name=block.get('league');games=block.get('games') or []
   if not name:failures.append('league without name');continue
   provider=block.get('provider') or 'unknown'
   if provider=='unknown':warnings.append(name+': missing provider attribution')
   if block.get('error'):warnings.append(name+': '+str(block['error'])[:90])
   seen=set()
   for g in games:
    ident=str(g.get('id') or '')
    if not ident:failures.append(name+': game without id')
    if ident in seen:failures.append(name+': duplicate game '+ident)
    seen.add(ident)
    if len(g.get('teams') or [])!=2:failures.append(name+': game missing two teams '+ident)
    if not g.get('date'):failures.append(name+': game missing date '+ident)
   leagues.append({'league':name,'provider':provider,'games':len(games),'fallback_used':block.get('fallback_used',provider=='espn'),'error':block.get('error')})
 match=read('data/epl-match-center.json')
 if match:
  age=age_hours(match.get('issued_at_utc'),now)
  if age is None or age>48:warnings.append('EPL Match Center export stale or undated')
  if match.get('status')!='provisional_research':failures.append('unapproved EPL Match Center release status')
  if not match.get('source_provider'):warnings.append('EPL Match Center missing source provider')
  if match.get('source_provider','').lower().startswith('espn'):warnings.append('EPL Match Center uses ESPN fallback, not official-first source')
  if not isinstance(match.get('fixtures'),list):failures.append('EPL Match Center fixtures invalid')
 else:warnings.append('EPL Match Center export unavailable')
 return {'checked_at':now.isoformat(),'status':'fail' if failures else 'pass_with_warnings' if warnings else 'pass','failures':failures,'warnings':warnings,'scoreboard_leagues':leagues,'epl_match_center':{'source_provider':match.get('source_provider') if match else None,'status':match.get('status') if match else None,'fixtures':len(match.get('fixtures') or []) if match else 0}}
def main():
 result=audit()
 (ROOT/'data/feed-integrity-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'status':result['status'],'failures':result['failures'],'warnings':result['warnings'],'leagues':len(result['scoreboard_leagues'])},indent=2))
 return 1 if result['failures'] else 0
if __name__=='__main__':sys.exit(main())

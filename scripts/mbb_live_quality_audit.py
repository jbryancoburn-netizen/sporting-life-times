#!/usr/bin/env python3
"""Read-only, reproducible 365-team schedule quality audit."""
import json,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1]; data=root/'data'
cross=json.loads((data/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
registry=json.loads((data/'mbb-arena-registry.json').read_text())['teams']
summary=collections.Counter();schools=[];problem_examples=[]
for team in cross:
 tid=str(team.get('espn_id',''));p=data/'mbb-schedules-2026-27'/(tid+'.json')
 if not p.exists():summary['missing_school_files']+=1;continue
 d=json.loads(p.read_text());summary['school_files_scanned']+=1;stats=collections.Counter()
 for e in d.get('events',[]):
  summary['game_records']+=1;stats['games']+=1
  c=(e.get('competitions') or [{}])[0];ps=c.get('competitors') or []
  own=next((x for x in ps if str((x.get('team') or {}).get('id'))==tid),None)
  opp=next((x for x in ps if own is not x),None)
  side=(own or {}).get('homeAway')
  verified=e.get('site_verified') is True and side in ('home','away','neutral')
  if verified:summary['verified_site']+=1;stats['verified_site']+=1
  else:summary['unverified_site']+=1;stats['unverified_site']+=1
  if side in ('home','away','neutral'):summary['classified_site']+=1
  else:summary['unclassified_site']+=1
  if verified and opp:
   expected={'home':'away','away':'home','neutral':'neutral'}[side]
   if opp.get('homeAway')!=expected:summary['contradictory_opponent_side']+=1
   if e.get('neutralSite')!=(side=='neutral'):summary['contradictory_neutral_flag']+=1
  v=c.get('venue') or {}
  arena=v.get('arenaName') or ''
  if not arena:summary['missing_game_arena']+=1;stats['missing_game_arena']+=1
  if not e.get('broadcasts') and not c.get('broadcasts'):summary['missing_broadcast']+=1
  if not verified and len(problem_examples)<20:problem_examples.append({'school':team['name'],'date':e.get('date'),'opponent':e.get('name'),'site':side})
 schools.append({'school':team['name'],'id':tid,**stats})
summary['home_arenas_registered']=sum(bool(a.get('home_arena')) for a in registry.values())
summary['home_arenas_missing']=len(registry)-summary['home_arenas_registered']
out={'summary':dict(summary),'worst_schools':sorted(schools,key=lambda x:x.get('unverified_site',0),reverse=True)[:30],'unverified_examples':problem_examples,'source':'Current committed data; verified means site_verified=true, not inference from city or arena registry'}
(data/'mbb-live-quality-audit-2026-27.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out['summary'],indent=2))

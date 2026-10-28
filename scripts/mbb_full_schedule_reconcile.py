#!/usr/bin/env python3
"""Whole-league schedule reconciliation: preserve facts, report unresolved metadata."""
import json,pathlib,collections,re
root=pathlib.Path(__file__).resolve().parents[1]
teams=[t for t in json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')]
assert len(teams)==365
branding=json.loads((root/'data/mbb-branding.json').read_text()).get('teams',{})
def norm(x):return re.sub('[^a-z0-9]','',str(x or '').lower())
aliases=collections.defaultdict(set)
for t in teams:
 for name in (t.get('name'),t.get('espn_name')):
  if name:aliases[norm(name)].add(str(t['espn_id']))
ids={k:next(iter(v)) for k,v in aliases.items() if len(v)==1}
summary=collections.Counter();rows=[]
for team in teams:
 id=str(team['espn_id']);p=root/'data/mbb-schedules-2026-27'/(id+'.json')
 if not p.exists():rows.append({'team':team['name'],'status':'missing_file'});summary['missing_files']+=1;continue
 d=json.loads(p.read_text());n=collections.Counter();changed=False
 for e in d.get('events',[]):
  n['games']+=1;c=(e.get('competitions') or [{}])[0];participants=c.get('competitors') or []
  opp=next((x for x in participants if str((x.get('team') or {}).get('id'))!=id),None)
  if opp:
   obj=opp.get('team') or {};oid=str(obj.get('id') or '')
   candidate=ids.get(norm(obj.get('displayName') or obj.get('name') or e.get('name')))
   if not oid and candidate and candidate!=id:
    obj['id']=candidate;oid=candidate;changed=True;n['opponent_id_resolved']+=1
   if oid in branding and not obj.get('logo'):
    obj['logo']='https://a.espncdn.com/i/teamlogos/ncaa/500/'+oid+'.png'
    changed=True;n['logo_url_added']+=1
   if not oid:n['opponent_id_missing']+=1
   if not obj.get('logo'):n['logo_missing']+=1
  v=c.get('venue') or {}
  if not v.get('arenaName'):n['arena_unverified']+=1
  if not (v.get('address') or {}).get('city'):n['city_unverified']+=1
  own=next((x for x in participants if str((x.get('team') or {}).get('id'))==id),{})
  if own.get('homeAway') not in ('home','away') and e.get('site_verified') is not True:n['site_unverified']+=1
  if not e.get('official_time'):n['time_unverified']+=1
  if not (c.get('broadcasts') or e.get('broadcasts')):n['network_unverified']+=1
 if changed:
  d['identity_reconciliation']='Exact unique crosswalk match only; no inferred arena, home court, tipoff or broadcaster.'
  p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
  summary['files_changed']+=1
 summary.update(n)
 rows.append({'team':team['name'],'id':id,'status':'checked','modified':changed,**n})
out={'schools':365,'summary':dict(summary),'limitations':'Completeness audit and exact-ID repair, not external fact verification or image URL availability check','school_results':rows}
(root/'data/mbb-365-final-schedule-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'schools':365,'summary':dict(summary)},indent=2))

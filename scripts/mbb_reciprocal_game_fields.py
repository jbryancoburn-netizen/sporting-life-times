#!/usr/bin/env python3
"""Copy explicitly sourced arena/city/TV across unique reciprocal games.
Local school times are intentionally retained at their original school.
"""
import json,pathlib,collections
D=pathlib.Path(__file__).resolve().parents[1]/'data'
teams=json.loads((D/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
docs={};pairs=collections.defaultdict(list);changed=set();counts=collections.Counter();conflicts=[]
for t in teams:
 tid=str(t['espn_id']);p=D/'mbb-schedules-2026-27'/(tid+'.json');d=json.loads(p.read_text());docs[tid]=(p,d)
 for e in d.get('events',[]):
  c=e['competitions'][0];ids=[str(x.get('team',{}).get('id','')) for x in c['competitors']]
  if len(ids)==2 and all(ids) and tid in ids:pairs[(e['date'][:10],tuple(sorted(ids)))].append((tid,e,c))
for key,items in pairs.items():
 if len(items)!=2 or items[0][0]==items[1][0]:continue
 for source,target in [items,items[::-1]]:
  sid,se,sc=source;tid,te,tc=target;sv=sc.get('venue',{});tv=tc.setdefault('venue',{})
  for field,src in [('arenaName','arena_source_url'),('official_school_city','city_source_url')]:
   origin=sv.get(src,'')
   if not origin.startswith('https://') or 'default_not_game_specific' in sv.get('arena_source_type',''):continue
   if sv.get(field) and not tv.get(field):
    tv[field]=sv[field];tv[src]=origin;tv[field+'_verified_via']='reciprocal_official_game';counts[field]+=1;changed.add(tid)
  broadcasts=sc.get('broadcasts',[])
  origin=se.get('broadcast_source_url') or next((b.get('source_url') for b in broadcasts if b.get('source_url')),'')
  if broadcasts and origin.startswith('https://') and not tc.get('broadcasts'):
   tc['broadcasts']=broadcasts;te['broadcast_source_url']=origin;counts['broadcasts']+=1;changed.add(tid)
for tid in changed:
 p,d=docs[tid];p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
report={'schools_changed':len(changed),'fields_added':dict(counts)}
(D/'mbb-reciprocal-game-fields.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

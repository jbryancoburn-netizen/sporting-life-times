#!/usr/bin/env python3
"""Propagate already source-verified game sites across reciprocal Division I schedules."""
import json,pathlib,collections
from mbb_event_evidence_recovery import apply_saved
apply_saved(sites_only=True)
base=pathlib.Path(__file__).resolve().parents[1]/'data'
teams=[t for t in json.loads((base/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')]
records={};index=collections.defaultdict(list);counts=collections.Counter();conflicts=[]
for t in teams:
 tid=str(t['espn_id']);p=base/'mbb-schedules-2026-27'/(tid+'.json')
 if not p.exists():continue
 d=json.loads(p.read_text());records[tid]=(p,d)
 for e in d.get('events',[]):
  day=str(e.get('date') or '')[:10];ps=(e.get('competitions') or [{}])[0].get('competitors') or []
  own=next((x for x in ps if str((x.get('team') or {}).get('id'))==tid),None)
  op=next((x for x in ps if x is not own),None)
  if own and op:
   oid=str((op.get('team') or {}).get('id') or '')
   if oid and oid!=tid:
    index[(day,tuple(sorted([tid,oid])))].append((tid,e,own,op))
for (day,pair),matches in index.items():
 if len(matches)!=2 or matches[0][0]==matches[1][0]:continue
 counts['reciprocal_pairs']+=1
 verified=[m for m in matches if m[1].get('site_verified') is True and m[2].get('homeAway') in ('home','away','neutral')]
 if not verified:continue
 if len(verified)==2:
  left,right=verified
  a,b=left[2]['homeAway'],right[2]['homeAway']
  expected='away' if a=='home' else 'home' if a=='away' else 'neutral'
  if b!=expected:
   conflict={'date':day,'teams':pair,'claimed':[a,b],'reason':'official opponent schedules contradict on home-away-neutral'}
   conflicts.append(conflict)
   for tid,event,own,op in verified:
    event['site_verified']=False
    event['site_conflict']=conflict
    counts['schools_updated_'+tid]+=1
  continue
 source=verified[0];dest=matches[0] if matches[1] is source else matches[1]
 side=source[2]['homeAway'];new='away' if side=='home' else 'home' if side=='away' else 'neutral'
 origin=source[1].get('site_source_url') or source[1].get('school_source_url') or records[source[0]][1].get('source_url')
 if not origin or not origin.startswith('https://'):continue
 event=dest[1];event['site_verified']=True;event['site_source_url']=origin
 event['site_verified_via']='reciprocal_official_opponent_schedule'
 dest[2]['homeAway']=new;dest[3]['homeAway']=side
 event['neutralSite']=new=='neutral'
 counts['reciprocal_sites_recovered']+=1;counts['schools_updated_'+dest[0]]+=1
for tid,(p,d) in records.items():
 if counts['schools_updated_'+tid]:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
summary={k:v for k,v in counts.items() if not k.startswith('schools_updated_')}
summary['school_files_updated']=sum(bool(counts['schools_updated_'+tid]) for tid in records)
summary['conflicts']=len(conflicts)
out={'summary':summary,'conflicts':conflicts,'method':'Propagate unique reciprocal same-day games only from already official-source-verified university records.'}
(base/'mbb-reciprocal-official-recovery.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(summary,indent=2))

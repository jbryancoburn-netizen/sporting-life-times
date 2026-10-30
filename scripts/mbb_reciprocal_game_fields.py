#!/usr/bin/env python3
"""Copy explicitly sourced arena/city/TV across unique reciprocal games.
Only explicitly zoned tipoffs can cross between school calendars.
"""
import json,pathlib,collections,re
D=pathlib.Path(__file__).resolve().parents[1]/'data'
teams=json.loads((D/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
docs={};pairs=collections.defaultdict(list);changed=set();counts=collections.Counter();conflicts=[]
for t in teams:
 tid=str(t['espn_id']);p=D/'mbb-schedules-2026-27'/(tid+'.json');d=json.loads(p.read_text());docs[tid]=(p,d)
 for e in d.get('events',[]):
  c=e['competitions'][0];ids=[str(x.get('team',{}).get('id','')) for x in c['competitors']]
  if len(ids)==2 and all(ids) and tid in ids:pairs[(e['date'][:10],tuple(sorted(ids)))].append((tid,e,c))
# Extract facilities only from explicit, game-specific official location text.
# This recovers named arenas that the schedule renderer can see but the data field lacks.
FACILITY=re.compile(r"\\b(?:[A-Z][A-Za-z0-9'.&-]*\\s+){1,7}(?:Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Stadium|Dome|Auditorium)\\b",re.I)
for tid,(path,doc) in docs.items():
 for event in doc.get('events',[]):
  comp=(event.get('competitions') or [{}])[0]
  venue=comp.setdefault('venue',{})
  if venue.get('arenaName') or not event.get('official_source'):continue
  source=event.get('school_source_url') or doc.get('source_url') or ''
  if not str(source).startswith('https://'):continue
  raw=(venue.get('official_school_location') or venue.get('fullName') or '').strip()
  if not raw or re.search(r'Choose A Location|All Games Home|Select Location|TBA|TBD',raw,re.I):continue
  found=FACILITY.findall(raw)
  if len(found)!=1:continue
  candidate=found[0].strip()
  # Reject date/event marketing text; only explicit facility labels qualify.
  if len(candidate)>85:continue
  venue['arenaName']=candidate
  venue['arena_source_url']=source
  venue['arena_source_type']='explicit_official_game_location_text'
  counts['official_facility_names_extracted']+=1
  changed.add(tid)
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
  # An explicit timezone travels with the time, so it stays unambiguous on
  # the opponent's page. Never infer a zone from the school or game city.
  time=se.get('official_school_time') or se.get('official_time') or ''
  oldtime=te.get('official_school_time') or te.get('official_time') or ''
  time_source=se.get('official_school_time_source') or se.get('official_time_source')
  if not time_source and se.get('official_source'):time_source=se.get('school_source_url')
  if (re.fullmatch(r'\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)\s*\(?(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\)?',time,re.I)
      and (not oldtime or re.search('TBA|TBD',oldtime,re.I))
      and str(time_source or '').startswith('https://')):
   te['official_school_time']=time;te['official_school_time_source']=time_source
   te['tipoff_verified_via']='reciprocal_official_game_with_explicit_timezone'
   counts['zoned_tipoffs']+=1;changed.add(tid)
for tid in changed:
 p,d=docs[tid];p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
report={'schools_changed':len(changed),'fields_added':dict(counts)}
(D/'mbb-reciprocal-game-fields.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

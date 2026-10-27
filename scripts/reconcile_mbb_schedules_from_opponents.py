#!/usr/bin/env python3
"""Cross-confirm missing MBB calendars from opponents' official university schedules.

Never invent a matchup: every candidate points to a verified athletics-source game.
Preserve all existing university-verified calendars and identify partial coverage honestly.
"""
import collections,copy,datetime,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'data/mbb-schedules-2026-27'
cross=json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
byid={str(t['espn_id']):t for t in cross}
audit=json.loads((folder/'official-school-sources-status.json').read_text())
missing=[x for x in audit['results'] if x['status'] not in ('verified-official','official-preserved')]
confirmed=collections.defaultdict(dict)
for file in folder.glob('*.json'):
 if not file.stem.isdecimal():continue
 try:record=json.loads(file.read_text())
 except (OSError,ValueError):continue
 if not record.get('verified_from_school') and record.get('source_name')!='Indiana University Athletics official 2026-27 schedule':continue
 source_id=str(record.get('espn_team_id') or file.stem)
 for e in record.get('events',[]):
  competitors=e.get('competitions',[{}])[0].get('competitors',[])
  if len(competitors)!=2:continue
  eids=[str(c.get('team',{}).get('id','')) for c in competitors]
  if any(x not in byid for x in eids) or source_id not in eids:continue
  date=str(e.get('date',''))[:10]
  if not date.startswith(('2026-','2027-')):continue
  for eid in eids:
   if eid==source_id:continue
   key=date+'_'+source_id
   game=copy.deepcopy(e)
   game['id']='cross-school-'+eid+'-'+key
   game['opponent_official_source']=record.get('source_url') or record.get('events',[{}])[0].get('school_source_url','')
   game['source_school_id']=source_id
   game['verified_by_opponent_school']=True
   confirmed[eid][key]=game
out=[]
for target in missing:
 t=next((x for x in cross if x['name']==target['team']),None)
 if not t:out.append({'team':target['team'],'status':'name-not-found'});continue
 eid=str(t['espn_id'])
 path=folder/(eid+'.json')
 rows=list(confirmed[eid].values())
 # Avoid duplicate dates+opponents originating from mirrored school calendars.
 unique={}
 for g in rows:
  opp=next((str(c.get('team',{}).get('id','')) for c in g['competitions'][0]['competitors'] if str(c.get('team',{}).get('id',''))!=eid),'')
  unique[(g['date'][:10],opp)]=g
 rows=sorted(unique.values(),key=lambda x:x['date'])
 if path.exists():
  try:
   previous=json.loads(path.read_text())
   if previous.get('verified_from_school') or previous.get('source_name')=='Indiana University Athletics official 2026-27 schedule':
    out.append({'team':t['name'],'status':'official-preserved','games':len(previous.get('events',[]))});continue
  except (OSError,ValueError):pass
 if len(rows)<20:
  out.append({'team':t['name'],'status':'not-enough-opponent-confirmations','games':len(rows)})
  continue
 # Opponent-confirmed dates are valid game evidence, but never claim a complete or direct team-source schedule.
 payload={'season':'2026-27','espn_team_id':eid,'team_id':t['id'],'source_name':'Cross-verified from opponents official university athletics schedules','source_method':'opponent-university-athletics','verified_by_opponents':True,
 'coverage':'partial; one-or-more universities may not yet list every scheduled game','fetched_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'events':rows}
 path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 out.append({'team':t['name'],'status':'published-opponent-confirmed-partial','games':len(rows)})
report={'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'remaining_schools':len(missing),'published_opponent_confirmed':sum(x['status']=='published-opponent-confirmed-partial' for x in out),'results':out}
(folder/'opponent-confirmation-status.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

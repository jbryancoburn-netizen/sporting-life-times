#!/usr/bin/env python3
"""MBB step 1: conservative all-school data reconciliation; no guesses or destructive fuzzy merging."""
import pathlib,json,collections,hashlib,datetime
root=pathlib.Path(__file__).resolve().parents[1]
base=root/'data/mbb-schedules-2026-27'
teams=[x for x in json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if x.get('espn_id')]
assert len(teams)==365
known={str(x['espn_id']) for x in teams}
summary=collections.Counter();by_school=[];flags=[]
def report(team,date,opponent,problem,detail=''):
 summary[problem]+=1
 flags.append({'team':team,'date':date,'opponent':opponent,'problem':problem,'detail':detail})
for t in teams:
 tid=str(t['espn_id']);p=base/(tid+'.json')
 row={'school':t['name'],'espn_id':tid,'games':0,'exact_duplicates_removed':0,'problems':collections.Counter()}
 if not p.exists():
  report(t['name'],'','','missing_schedule');by_school.append(row);continue
 try:d=json.loads(p.read_text())
 except Exception as ex:
  report(t['name'],'','','invalid_json',str(ex));by_school.append(row);continue
 events=d.get('events',[])
 if not isinstance(events,list):
  report(t['name'],'','','invalid_event_list');by_school.append(row);continue
 distinct=[];exact=set();seen_matchups=collections.defaultdict(list)
 for e in events:
  # Identical full records are duplicate imports, not legitimate distinct contests.
  fingerprint=json.dumps(e,sort_keys=True,ensure_ascii=False,separators=(',',':'))
  if fingerprint in exact:
   row['exact_duplicates_removed']+=1;summary['exact_duplicates_removed']+=1;continue
  exact.add(fingerprint);distinct.append(e)
  day=str(e.get('date') or '')[:10]
  comps=e.get('competitions') or []
  c=comps[0] if comps else {}
  players=c.get('competitors') or []
  selfteam=next((v for v in players if str((v.get('team') or {}).get('id') or '')==tid),None)
  opponents=[v for v in players if v is not selfteam]
  opp=opponents[0] if opponents else {}
  obj=opp.get('team') or {}
  oid=str(obj.get('id') or '')
  oname=obj.get('displayName') or obj.get('name') or e.get('name') or 'Unknown'
  matchup=(day,oid if oid else oname.strip().lower())
  seen_matchups[matchup].append(e)
  if not day or len(day)!=10:report(t['name'],day,oname,'invalid_date')
  if selfteam is None:report(t['name'],day,oname,'team_not_in_competitors')
  if not opponents:report(t['name'],day,oname,'opponent_missing')
  if oid and oid not in known:report(t['name'],day,oname,'opponent_outside_d1','Could be a legitimate non-D1 opponent; do not replace')
  if not oid:report(t['name'],day,oname,'opponent_id_missing')
  site=selfteam.get('homeAway') if selfteam else None
  if site not in ('home','away','neutral') or e.get('site_verified') is not True:report(t['name'],day,oname,'site_unverified')
  elif site=='neutral' and e.get('neutralSite') is False:report(t['name'],day,oname,'neutral_conflict')
  elif site in ('home','away') and e.get('neutralSite') is True:report(t['name'],day,oname,'home_away_conflict')
  v=c.get('venue') or {}
  if not v.get('arenaName'):report(t['name'],day,oname,'arena_unverified')
  if not (v.get('address') or {}).get('city') and not v.get('official_school_location'):report(t['name'],day,oname,'city_unverified')
  if not obj.get('logo'):report(t['name'],day,oname,'logo_missing')
  if not e.get('official_time') or str(e['official_time']).upper()=='TBA':report(t['name'],day,oname,'tipoff_missing')
  if not (c.get('broadcasts') or e.get('broadcasts')):report(t['name'],day,oname,'network_missing')
 for (date,opp),matches in seen_matchups.items():
  if len(matches)>1:report(t['name'],date,opp,'possible_duplicate_matchup',str(len(matches))+' nonidentical records; preserved for review')
 row['games']=len(distinct)
 if len(distinct)!=len(events):
  d['events']=distinct
  d['data_reconciliation']={'rule':'Only byte-equivalent normalized JSON game events removed','exact_duplicates_removed':len(events)-len(distinct)}
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 summary['schools_scanned']+=1;summary['games_after_exact_dedupe']+=len(distinct)
 by_school.append(row)
summary['schools_targeted']=365
out={'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Read all 365 files; delete only exact JSON duplicate game objects. Preserve conflicting matchups and unverified facts for source review.','summary':dict(summary),'schools':by_school}
(root/'data/mbb-step1-reconciliation-summary.json').write_text(json.dumps(out,indent=2,default=dict)+'\n')
(root/'data/mbb-step1-reconciliation-flags.json').write_text(json.dumps({'summary':dict(summary),'issues':flags},indent=2)+'\n')
print(json.dumps(dict(summary),indent=2))

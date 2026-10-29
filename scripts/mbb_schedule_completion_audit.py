#!/usr/bin/env python3
"""Audit required team-page fields without treating a blank as announced TBA."""
import json,pathlib,collections,datetime
D=pathlib.Path(__file__).resolve().parents[1]/'data'
teams=json.loads((D/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'];results=[];total=collections.Counter()
for team in teams:
 tid=str(team['espn_id']);d=json.loads((D/'mbb-schedules-2026-27'/(tid+'.json')).read_text());missing=collections.Counter()
 for e in d.get('events',[]):
  c=e['competitions'][0];v=c.get('venue',{});total['games']+=1
  if not e.get('site_verified'):missing['site']+=1
  if not v.get('arenaName'):missing['arena']+=1
  if not (v.get('official_school_city') or v.get('address',{}).get('city')):missing['city']+=1
  if not (e.get('official_school_time') or e.get('official_time')):missing['tipoff']+=1
  if not (c.get('broadcasts') or e.get('broadcasts')):missing['broadcast']+=1
 for key,n in missing.items():total['missing_'+key]+=n
 results.append({'school':team['name'],'id':tid,'games':len(d.get('events',[])),'all_required_fields_present':not bool(missing),'missing':dict(missing),'source_url':d.get('source_url','')})
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':{'schools':len(results),'schools_with_all_fields_present':sum(x['all_required_fields_present'] for x in results),**dict(total)},'note':'Field presence is not full source certification. Blank fields remain unresolved; explicit official TBA listings are retained.','schools':results}
(D/'mbb-schedule-completion-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary'],indent=2))

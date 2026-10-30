#!/usr/bin/env python3
"""Apply event-organizer venues and explicitly reviewed site corrections.
Matches require exact date and both team IDs; never use a team's default arena.
"""
import json,pathlib,collections,copy
D=pathlib.Path(__file__).resolve().parents[1]/'data'
FILE=D/'mbb-organizer-game-evidence.json'
def apply(documents, rows, sites_only=False):
 changes=[]
 for row in rows:
  ids=set(row['team_ids'])
  if sites_only and not row.get('site_override'):continue
  for tid in ids:
   doc=documents.get(tid)
   if not doc:continue
   matches=[e for e in doc.get('events',[]) if e.get('date','')[:10]==row['date'] and {str(x.get('team',{}).get('id')) for x in e['competitions'][0]['competitors']}==ids]
   if len(matches)!=1:continue
   e=matches[0];c=e['competitions'][0];v=c.setdefault('venue',{});fields=[]
   for key,source in [('arenaName','arena_source_url'),('official_school_city','city_source_url')]:
    val=row.get(key)
    if val and (not v.get(key) or row.get('correct_location')) and v.get(key)!=val:
     v[key]=val;v[source]=row['source_url'];fields.append(key)
   if row.get('site_override'):
    side=row['site_override']
    assert side=='neutral'
    if not e.get('site_verified') or e.get('site_conflict') or any(x.get('homeAway')!='neutral' for x in c['competitors']):
     for x in c['competitors']:x['homeAway']='neutral'
     e.update(site_verified=True,neutralSite=True,site_source_url=row['site_source_url'],site_verified_via='specific_event_announcement_and_host_evidence');e.pop('site_conflict',None);fields.append('site')
   if fields:changes.append({'id':tid,'event_id':e['id'],'date':row['date'],'fields':fields,'source_url':row['source_url']})
 return changes
def apply_saved(sites_only=False):
 if not FILE.exists():return []
 rows=json.loads(FILE.read_text())['games'];docs={p.stem:json.loads(p.read_text()) for p in (D/'mbb-schedules-2026-27').glob('*.json')}
 changes=apply(docs,rows,sites_only)
 for tid in {x['id'] for x in changes}:(D/'mbb-schedules-2026-27'/f'{tid}.json').write_text(json.dumps(docs[tid],ensure_ascii=False,separators=(',',':'))+'\n')
 return changes
if __name__=='__main__':
 changes=apply_saved();summary={'schools_updated':len({x['id'] for x in changes}),'fields_updated':dict(collections.Counter(k for x in changes for k in x['fields']))}
 (D/'mbb-organizer-recovery-report.json').write_text(json.dumps({'summary':summary,'changes':changes},indent=2)+'\n');print(json.dumps(summary))

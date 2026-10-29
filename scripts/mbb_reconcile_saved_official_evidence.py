#!/usr/bin/env python3
"""Reconcile saved official game rows using unique school identities, never date alone."""
import json,re,pathlib,collections,importlib.util
sp=importlib.util.spec_from_file_location('fields',pathlib.Path(__file__).with_name('mbb_complete_official_fields.py'));m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
def schoolkey(s):
 s=re.sub(r'\([^)]*\)','',m.clean_school_label(s).lower())
 s=re.sub(r'^(?:the )?(?:university|college) of ','',s)
 s=re.sub(r'\bthe\b',' ',s)
 s=re.sub(r'\b(?:state|saint)\b','st',s)
 return re.sub('[^a-z0-9]','',s)
exact=collections.defaultdict(set);index=collections.defaultdict(set);byid={str(t['espn_id']):dict(t) for t in m.TEAMS}
for t in m.TEAMS:
 for n in [t['name'],t.get('espn_name')]:
  if n:
   exact[m.norm(n)].add(str(t['espn_id']));index[schoolkey(n)].add(str(t['espn_id']))
registry=json.loads((m.DATA/'mbb-logo-registry.json').read_text())['teams']
for tid,record in registry.items():
 if tid not in byid or not str(record.get('provider_identity_status','')).startswith('provider_identity_matched'):continue
 for label in [record.get('school'),record.get('display_name'),record.get('provider_team_name')]:
  if label:exact[m.norm(label)].add(tid);index[schoolkey(label)].add(tid)
 if not byid[tid].get('espn_name') and record.get('provider_team_name'):byid[tid]['espn_name']=record['provider_team_name']
def resolve(name):
 matches=exact.get(m.norm(name),set())
 if len(matches)==1:return next(iter(matches))
 key=schoolkey(name);matches=index.get(key,set())
 if len(matches)==1:return next(iter(matches))
 if matches or len(key)<5:return ''
 core=re.sub(r'university$','',key)
 if core!=key and len(index.get(core,set()))==1:return next(iter(index[core]))
 matches={tid for label,ids in index.items() if label.startswith(key) for tid in ids}
 return next(iter(matches)) if len(matches)==1 else ''
def main():
 reports=[];total=collections.Counter()
 for team in m.TEAMS:
  tid=str(team['espn_id']);evidence=m.DATA/'mbb-official-game-evidence'/(tid+'.json')
  if not evidence.exists():continue
  facts=json.loads(evidence.read_text());url=facts['source_url'];p=m.DATA/'mbb-schedules-2026-27'/(tid+'.json');d=json.loads(p.read_text());count=collections.Counter();lookup=collections.defaultdict(list);rows=[]
  for row in facts['rows']:
   oid=row.get('opponent_id') or resolve(row['opponent'])
   if oid==tid:continue
   copy=dict(row)
   if oid:
    copy['opponent']=byid[oid]['name'];copy['opponent_original']=row.get('opponent_original',row['opponent'])
    lookup[(row['date'],oid)].append(copy)
   rows.append(copy)
  for e in d.get('events',[]):
   c=e['competitions'][0];ps=c['competitors'];own=next((x for x in ps if str(x.get('team',{}).get('id'))==tid),None)
   if own is None:continue
   other=next((x for x in ps if x is not own),{});ot=other.get('team',{});oid=str(ot.get('id') or '')
   if not oid:oid=resolve(ot.get('displayName',''))
   if not oid or oid==tid:continue
   matches=lookup.get((e['date'][:10],oid),[])
   if len(matches)!=1:continue
   r=matches[0];count['official_games_matched']+=1
   if not ot.get('id'):ot['id']=oid;e['official_opponent_identity_source']=url;count['opponent_ids_recovered']+=1
   v=c.setdefault('venue',{})
   facility,city=m.split_location(r.get('city',''));arena=r.get('arena') or facility
   if not facility:city=r.get('city','')
   if arena and not v.get('arenaName'):v.update(arenaName=arena,arena_source_url=url,arena_source_type='unique_official_game_identity_match');count['arenas_added']+=1
   if city and not v.get('official_school_city') and not v.get('address',{}).get('city'):v.update(official_school_city=city,city_source_url=url);count['cities_added']+=1
   if r.get('tv') and not c.get('broadcasts') and not e.get('broadcasts'):c['broadcasts']=[{'names':[r['tv']],'source_url':url}];e['broadcast_source_url']=url;count['broadcasts_added']+=1
   oldtime=e.get('official_school_time') or e.get('official_time') or ''
   if r.get('time') and (not oldtime or re.search('TBA|TBD',oldtime,re.I) and not re.search('TBA|TBD',r['time'],re.I)):
    e['official_school_time']=r['time'];e['official_school_time_source']=url;count['times_added']+=1
   if r.get('site_explicit') and r.get('site') in ('home','away','neutral') and not e.get('site_verified'):
    side=r['site'];own['homeAway']=side;other['homeAway']={'home':'away','away':'home','neutral':'neutral'}[side]
    e.update(site_verified=True,neutralSite=side=='neutral',site_source_url=url);e.pop('site_conflict',None);count['sites_verified']+=1
  added=m.add_missing_games(d,team,rows,url)
  if added:count['games_added']=added
  if sum(n for k,n in count.items() if k!='official_games_matched'):
   p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
  reports.append({'id':tid,'school':team['name'],**dict(count)});total.update(count)
 report={'summary':{'schools_checked':len(reports),'schools_changed':sum(any(k not in ('id','school','official_games_matched') for k in r) for r in reports),**dict(total)},'schools':reports}
 (m.DATA/'mbb-saved-evidence-reconciliation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary']))

if __name__=='__main__':main()

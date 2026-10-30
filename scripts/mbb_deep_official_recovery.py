#!/usr/bin/env python3
"""All-school, additive official-source recovery with strict date/identity matches.
Raw responses stay in a temporary cache; every applied field retains its source.
Never overwrite an announced value or infer a venue/network from the host school.
"""
import collections, concurrent.futures, copy, datetime, json, pathlib, re, tempfile
from urllib.parse import urlparse
import requests
import mbb_complete_official_fields as parser
D=parser.DATA
TIME=re.compile(r'(?:\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?|noon|midnight|TBA|TBD)(?:\s*\(?(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\)?)?',re.I)
CACHE=pathlib.Path(tempfile.gettempdir())/'mbb-deep-source-cache';CACHE.mkdir(exist_ok=True)
TEAM={str(t['espn_id']):t for t in parser.TEAMS}
def aliases(e,tid):
 ps=e['competitions'][0]['competitors'];opp=next((p for p in ps if str(p.get('team',{}).get('id'))!=tid),{})
 t=TEAM.get(str(opp.get('team',{}).get('id')),{});
 return {parser.norm(x) for x in [e.get('name'),opp.get('team',{}).get('displayName'),t.get('name'),t.get('espn_name')] if x}
def apply(doc,tid,rows,url):
 changes=[];events=doc['events'];match_counts=collections.Counter()
 matching={}
 for i,e in enumerate(events):
  names=aliases(e,tid)
  matches=[j for j,r in enumerate(rows) if r['date']==e.get('date','')[:10] and parser.norm(r['opponent']) in names]
  if len(matches)==1:matching[i]=matches[0];match_counts[matches[0]]+=1
 for i,j in matching.items():
  if match_counts[j]!=1:continue
  e=events[i];r=rows[j];c=e['competitions'][0];v=c.setdefault('venue',{})
  def put(obj,key,val,src):
   if val and not obj.get(key):obj[key]=val;obj[src]=url;changes.append({'event_id':e.get('id'),'date':r['date'],'field':key,'value':val,'source_url':url})
  arena,city=r.get('arena','').strip(),r.get('city','').strip()
  # Require a named facility, not a lone generic word or an entire city string.
  if arena and parser.FACILITY.search(arena) and len(arena.split())>1 and not re.search(r'\b(?:TBA|TBD)\b',arena,re.I):put(v,'arenaName',arena,'arena_source_url')
  if city and not parser.FACILITY.search(city) and not re.search('TBA|TBD',city,re.I):put(v,'official_school_city',city,'city_source_url')
  time=r.get('time','').strip()
  if TIME.fullmatch(time) and not (e.get('official_school_time') or e.get('official_time')):put(e,'official_school_time',time,'official_school_time_source')
  tv=r.get('tv','').strip()
  if tv and parser.network_label(tv) and not (c.get('broadcasts') or e.get('broadcasts')):
   c['broadcasts']=[{'names':[tv],'source_url':url}];e['broadcast_source_url']=url
   changes.append({'event_id':e.get('id'),'date':r['date'],'field':'broadcast','value':tv,'source_url':url})
  side=r.get('site','')
  if side in ('home','away','neutral') and r.get('site_explicit') and not e.get('site_verified'):
   for p in c['competitors']:p['homeAway']=side if str(p.get('team',{}).get('id'))==tid else {'home':'away','away':'home','neutral':'neutral'}[side]
   e.update(site_verified=True,site_source_url=url,neutralSite=side=='neutral');e.pop('site_conflict',None)
   changes.append({'event_id':e.get('id'),'date':r['date'],'field':'site','value':side,'source_url':url})
 return changes,len(matching)
def run(t):
 tid=str(t['espn_id']);p=D/'mbb-schedules-2026-27'/f'{tid}.json';doc=json.loads(p.read_text());source=doc.get('source_url','')
 result={'id':tid,'school':t['name'],'attempts':[],'changes':[],'matches':0}
 if not source.startswith('https://'):return result
 host=urlparse(source).hostname or ''
 if any(s in host for s in ('espn.com','realgm.com','wikipedia.org','sports-reference.com')):return result
 candidates=[source,source.replace('/schedule/text/','/schedule/')]
 if '/schedule' in source:
  stem=source.split('/schedule')[0]+'/schedule'
  candidates +=[stem,stem+'/2026-27',stem+'/text/2026-27']
 seen=set()
 for idx,url in enumerate(dict.fromkeys(candidates)):
  try:
   r=requests.get(url,timeout=(5,12),headers={'User-Agent':'Mozilla/5.0'})
   attempt={'url':url,'status':r.status_code};result['attempts'].append(attempt)
   if not r.ok or urlparse(r.url).hostname!=host:continue
   rows=parser.parse(r.text,(t['name'],t.get('espn_name','')));attempt['rows']=len(rows)
   if not rows:continue
   (CACHE/f'{tid}-{idx}.html').write_text(r.text)
   for row in rows:
    a,city=parser.split_location(row.get('city',''))
    if a:
     row['arena']=row.get('arena') or a;row['city']=city
    if row.get('site') and 'site_explicit' not in row:row['site_explicit']=True
   signature=json.dumps(rows,sort_keys=True)
   if signature in seen:continue
   seen.add(signature)
   changes,matched=apply(doc,tid,rows,r.url);result['changes']+=changes;result['matches']=max(result['matches'],matched)
   # Once both the display page and a text page are tried, additional aliases
   # of the same page do not improve coverage.
   if len(seen)>=2:break
  except requests.RequestException as ex:result['attempts'].append({'url':url,'error':str(ex)[:120]})
 if result['changes']:p.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
 return result
if __name__=='__main__':
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  for r in pool.map(run,parser.TEAMS):
   results.append(r)
   if len(results)%20==0:print(f"Checked {len(results)} schools; {sum(len(x['changes']) for x in results)} fields added",flush=True)
 fields=collections.Counter(c['field'] for r in results for c in r['changes'])
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':{'schools_checked':len(results),'schools_changed':sum(bool(r['changes']) for r in results),'schools_parsed':sum(any(a.get('rows') for a in r['attempts']) for r in results),'matched_entries':sum(r['matches'] for r in results),'fields_added':dict(fields)},'schools':results}
 (D/'mbb-deep-official-recovery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report['summary']),flush=True)

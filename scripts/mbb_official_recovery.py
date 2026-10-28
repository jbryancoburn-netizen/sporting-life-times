#!/usr/bin/env python3
"""Revisit unsuccessful official-site checks using multiple official schedule layouts."""
import json,re,pathlib,requests,collections
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1]
cross=json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
failed=set()
for name in ('first-100','second-100','third-100','final-65'):
 p=root/'data'/('mbb-official-'+name+'-verification.json')
 if not p.exists():continue
 for s in json.loads(p.read_text())['schools']:
  if s['status']!='verified_matches':failed.add(str(s['id']))
session=requests.Session();session.headers['User-Agent']='Mozilla/5.0 (compatible; UniversityScheduleChecker/1.1)'
def norm(x):return re.sub('[^a-z0-9]','',str(x or '').lower())
def keyed(x):
 m=re.search(r'(20\d\d)[-/.](\d\d?)[-/.](\d\d?)',str(x))
 return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else ''
def variants(url):
 out=[url]
 if '/schedule/text/' in url:out.append(url.replace('/schedule/text/','/schedule/'))
 if '/schedule/' in url:out.append(url.replace('/schedule/','/schedule/text/'))
 if '/schedule/text/' in url:out.append(url.replace('/schedule/text/','/schedule/').replace('/2026-27','/2026'))
 return list(dict.fromkeys(out))
def from_structured(soup):
 rows=[]
 for script in soup.find_all('script',type='application/ld+json'):
  try:data=json.loads(script.string or script.get_text())
  except Exception:continue
  objects=data if isinstance(data,list) else [data]
  for obj in objects:
   if not isinstance(obj,dict):continue
   events=obj.get('itemListElement') or obj.get('events') or []
   for event in events:
    if isinstance(event,dict) and 'item' in event:event=event['item']
    if not isinstance(event,dict):continue
    dt=keyed(event.get('startDate'));title=event.get('name','')
    if dt and title:rows.append({'date':dt,'name':title,'location':str((event.get('location') or {}).get('name','')) if isinstance(event.get('location'),dict) else '','site':''})
 return rows
def from_html(soup):
 rows=[]
 for entry in soup.select('[data-date], [data-game-date], .sidearm-schedule-game, .schedule-game'):
  date=keyed(entry.get('data-date') or entry.get('data-game-date') or '')
  if not date:
   tag=entry.select_one('time[datetime]')
   if tag:date=keyed(tag.get('datetime'))
  if not date:continue
  opp=entry.select_one('.sidearm-schedule-game-opponent-name, .schedule-game-opponent, [class*="opponent-name"]')
  loc=entry.select_one('[class*="location"]')
  site=entry.select_one('[class*="home-away"], [class*="site-type"]')
  if opp:rows.append({'date':date,'name':opp.get_text(' ',strip=True),'location':loc.get_text(' ',strip=True) if loc else '', 'site':site.get_text(' ',strip=True).lower() if site else ''})
 return rows
results=[];metrics=collections.Counter()
for t in cross:
 tid=str(t.get('espn_id',''))
 if tid not in failed:continue
 p=root/'data/mbb-schedules-2026-27'/(tid+'.json')
 item={'team':t['name'],'id':tid,'status':'failed','matches':0}
 try:d=json.loads(p.read_text())
 except Exception:results.append(item);continue
 src=d.get('source_url','')
 if not src.startswith('https://'):item['status']='missing_official_url';results.append(item);continue
 schedule=[]
 for url in variants(src):
  try:
   resp=session.get(url,timeout=8)
   if not resp.ok:continue
   soup=BeautifulSoup(resp.text,'html.parser')
   schedule=from_html(soup) or from_structured(soup)
   if schedule:break
  except Exception:continue
 if not schedule:item['status']='no_machine_readable_schedule';results.append(item);continue
 # Only exact date and exact (normalized) opponent text; JSON-LD location can be stored as source text, not facility.
 for event in d.get('events',[]):
  date=str(event.get('date',''))[:10]
  c=(event.get('competitions') or [{}])[0]
  opp=next((v for v in c.get('competitors',[]) if str((v.get('team') or {}).get('id'))!=tid),None)
  if not opp:continue
  name=(opp.get('team') or {}).get('displayName') or (opp.get('team') or {}).get('name') or ''
  exact=[x for x in schedule if x['date']==date and norm(x['name'])==norm(name)]
  if len(exact)!=1:continue
  row=exact[0];item['matches']+=1
  if row['location']:
   c.setdefault('venue',{})['official_school_location']=row['location']
   c['venue']['source_url']=url
  # Site text only when explicit and unequivocal.
  if row['site'] in ('home','away','neutral'):
   own=next((v for v in c.get('competitors',[]) if str((v.get('team') or {}).get('id'))==tid),None)
   if own:
    own['homeAway']=row['site'];event['site_verified']=True;event['site_source_url']=url
 if item['matches']:
  p.write_text(json.dumps(d,separators=(',',':'),ensure_ascii=False)+'\n')
  item['status']='partial_structured_verification'
 metrics[item['status']]+=1;metrics['matches']+=item['matches'];results.append(item)
out={'failed_schools_targeted':len(failed),'status_counts':dict(metrics),'schools':results,'method':'Additional structured HTML/JSON-LD official schedule extraction; only exact opponent + date matches.'}
(root/'data/mbb-official-recovery-audit.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='schools'},indent=2))

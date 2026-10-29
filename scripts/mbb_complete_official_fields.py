#!/usr/bin/env python3
"""Refresh all school calendars, including SIDEARM NextGen semantic game cards.
Only unique date/opponent matches may enrich records. Never infer home from vs.
"""
import json,re,pathlib,datetime,concurrent.futures,collections,os
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
TEAMS=json.loads((DATA/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
def norm(s):return re.sub('[^a-z0-9]','',str(s or '').lower())
def parse(html, own_names=()):
 soup=BeautifulSoup(html,'html.parser')
 title=soup.title.get_text() if soup.title else ''
 if not re.search(r'2026\s*[-–/]\s*(?:20)?27',title):return []
 rows=[]
 # Nuxt's reference-indexed payload contains explicit H/A/N classifications.
 semantic={}
 node=soup.select_one('script#__NUXT_DATA__')
 if node:
  try:
   payload=json.loads(node.get_text())
   def deref(v):return payload[v] if type(v) is int and 0<=v<len(payload) else None
   for item in payload:
    if not isinstance(item,dict) or 'location_indicator' not in item or 'date' not in item:continue
    date=deref(item['date']);side=deref(item['location_indicator']);op=deref(item.get('opponent'))
    if not isinstance(op,dict) or not isinstance(date,str):continue
    name=deref(op.get('title'));side={'H':'home','A':'away','N':'neutral'}.get(side,'')
    if name and side:semantic[(date[:10],norm(name))]=side
  except (ValueError,TypeError,IndexError):pass
 # WMT Digital schedules expose semantic event containers and venue classes.
 cards=soup.select('.schedule-table-item') or soup.select('.schedule-event-item')
 for card in cards:
  def pick(selector):
   n=card.select_one(selector)
   return n.get_text(' ',strip=True) if n else ''
  candidates=[]
  for node in card.select('.schedule-event-item__opponent-name, .schedule-item-team__heading, .schedule-default-event__name'):
   label=re.sub(r'^(?:vs\.?|at)\s+','',node.get_text(' ',strip=True),flags=re.I)
   label=re.sub(r'^(?:No\.?\s*|#)\d+\s+','',label,flags=re.I)
   if norm(label) not in {norm(x) for x in own_names} and label not in candidates:candidates.append(label)
  opponent=candidates[0] if len(candidates)==1 else ''
  dn=card.select_one('time[datetime]');dt=dn.get('datetime','') if dn else ''
  if not opponent or not re.match(r'202[67]-\d\d-\d\d',dt):continue
  date=dt[:10]
  classes=' '.join(c for n in card.select('.schedule-event-date') for c in n.get('class',[]))
  side=next((x for x in ['neutral','away','home'] if 'venue-'+x in classes),'')
  time=pick('.schedule-event-date__clock') or pick('.schedule-event-item-result__label')
  if not re.fullmatch(r'(?:\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?|Noon|Midnight|TBA|TBD)(?:\s+\(?[A-Z]{2,4}\)?)?',time,re.I):time=''
  arena=pick('.schedule-event-item__location-venue, .schedule-event-item__venue')
  city=pick('.schedule-event-item__location-place')
  loc=pick('.schedule-event-location')
  if not arena and not city and loc:
   if ' / ' in loc:city,arena=loc.rsplit(' / ',1)
   elif re.search(r'Arena|Center|Centre|Coliseum|Gym|Fieldhouse|Pavilion|Forum|Dome|Auditorium|Stadium',loc,re.I):arena=loc
   else:city=loc
  networks=[]
  for link in card.select('a.schedule-event-links__link, a.schedule-event-item-links__link'):
   labelnode=link.select_one('.schedule-event-item-links__title')
   image=link.select_one('img[alt]')
   label=labelnode.get_text(' ',strip=True) if labelnode else image.get('alt','') if image else ''
   label=re.sub(r'^(?:Watch|TV):\s*','',label,flags=re.I).strip()
   if re.fullmatch(r'ESPN(?:\+|2|U|NEWS)?|ABC|CBS|CBS Sports Network|CBSSN|FOX|FS[12]|BTN|B1G\+|Big Ten Network|Peacock|NBC|ACC Network(?: Extra)?|ACCN|SECN|SEC Network(?:\+)?|FloSports|FloHoops|The CW|CW|TNT|truTV|MWN|Mountain West Network',label,re.I) and label not in networks:networks.append(label)
  rows.append(dict(date=date,opponent=opponent,time=time,arena=arena.strip(),city=city.strip(),tv=' / '.join(networks),site=side,site_explicit=bool(side),exhibition=bool(card.select_one('.schedule-event-exhibition'))))
 if rows:return rows
 for table in soup.select('table'):
  trs=table.select('tr')
  if not trs:continue
  heads=[x.get_text(' ',strip=True).lower() for x in trs[0].find_all(['th','td'])]
  def col(*keys):return next((i for i,x in enumerate(heads) if x in keys),-1)
  di,oi,si,li,ti,bi=[col(*keys) for keys in [('date',),('opponent',),('at','site','home/away'),('location','venue'),('time','tipoff'),('tv','broadcast','network')]]
  if min(di,oi)<0:continue
  for tr in trs[1:]:
   cells=[x.get_text(' ',strip=True) for x in tr.find_all(['th','td'],recursive=False)]
   def val(i):return cells[i] if 0<=i<len(cells) else ''
   m=re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})',val(di),re.I)
   if not m:continue
   mo='jan feb mar apr may jun jul aug sep oct nov dec'.split().index(m[1].lower())+1
   loc=val(li);a=re.search(r'\(([^()]+)\)',loc)
   arena=a[1].strip() if a else loc.rsplit(' / ',1)[-1] if ' / ' in loc else ''
   if not re.search(r'Arena|Center|Centre|Coliseum|Gym|Fieldhouse|Pavilion|Forum|Dome|Auditorium',arena,re.I):arena=''
   rows.append(dict(date=f'{2026 if mo>=7 else 2027}-{mo:02d}-{int(m[2]):02d}',opponent=val(oi),time=val(ti),arena=arena,city=loc.split('(')[0].split(' / ')[0].strip() if arena else loc,tv=val(bi),site=val(si).lower() if val(si).lower() in ('home','away','neutral') else '',exhibition=bool(re.search(r'\bexhibition\b',val(oi),re.I))))
 if rows:return rows
 for card in soup.select('.sidearm-schedule-game[data-game-id]'):
  def pick(selector):
   node=card.select_one(selector)
   return node.get_text(' ',strip=True) if node else ''
  opponent=pick('.sidearm-schedule-game-opponent-name')
  day=pick('.sidearm-schedule-game-opponent-date')
  m=re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})',day,re.I)
  if not m or not opponent:continue
  mo='jan feb mar apr may jun jul aug sep oct nov dec'.split().index(m[1].lower())+1
  date=f'{2026 if mo>=7 else 2027}-{mo:02d}-{int(m[2]):02d}'
  spans=card.select('.sidearm-schedule-game-opponent-date > span')
  time=spans[-1].get_text(' ',strip=True) if len(spans)>1 else ''
  location=card.select_one('.sidearm-schedule-game-location')
  parts=[x.get_text(' ',strip=True) for x in location.find_all('span',recursive=False)] if location else []
  city=parts[0] if parts else ''
  arena=parts[-1] if len(parts)>1 else ''
  if arena and not re.search(r'Arena|Center|Centre|Coliseum|Gym|Fieldhouse|Field House|Pavilion|Forum|Dome|Auditorium|Events|Complex|Stadium',arena,re.I):
   arena=''
  classes=set(card.get('class',[]))
  site=next((side for side in ['neutral','away','home'] if 'sidearm-schedule-'+side+'-game' in classes),'')
  tv=pick('.sidearm-schedule-game-coverage-tv-content')
  rows.append(dict(date=date,opponent=opponent,time=time,arena=arena,city=city,tv=tv,site=site,site_explicit=bool(site),exhibition=bool(re.search(r'\bexhibition\b',card.get_text(' ',strip=True),re.I))))
 if rows:return rows
 for card in soup.select('[data-test-id="s-game-card-standard__root"]'):
  def pick(key):
   node=card.select_one('[data-test-id="'+key+'"]')
   return node.get_text(' ',strip=True) if node else ''
  opponent=pick('s-game-card-standard__header-team-opponent-link')
  day=pick('s-game-card-standard__header-game-date') or pick('s-game-card-standard__header-game-date-details')
  m=re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})',day,re.I)
  if not m or not opponent:continue
  mo='jan feb mar apr may jun jul aug sep oct nov dec'.split().index(m[1].lower())+1
  date=f'{2026 if mo>=7 else 2027}-{mo:02d}-{int(m[2]):02d}'
  time=pick('s-game-card-standard__header-game-time')
  time=re.sub(r'^.*?\)\s*','',time)
  if not re.fullmatch(r'(?:\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?|Noon|Midnight|TBA|TBD)(?:\s+[A-Z]{2,4})?',time,re.I):time=''
  arena=pick('s-game-card-facility-and-location__game-facility-title-link') or pick('s-game-card-facility-and-location__standard-facility-title')
  city=pick('s-game-card-facility-and-location__standard-location-details')
  tvnode=card.select_one('.s-game-card__header__tv')
  tv=re.sub(r'^TV:\s*','',tvnode.get_text(' ',strip=True)) if tvnode else ''
  stamp=pick('s-stamp__root').lower()
  rows.append(dict(date=date,opponent=opponent,time=time,arena=arena,city=city,tv=tv,site=semantic.get((date,norm(opponent)),'away' if stamp=='at' else ''),site_explicit=(date,norm(opponent)) in semantic,exhibition=bool(re.search(r'\bexhibition\b',card.get_text(' ',strip=True),re.I))))
 return rows

def add_missing_games(document,team,rows,source):
 """Import named published fixtures only on dates absent from the calendar.
 Date collisions stay unresolved to avoid duplicate games under school aliases.
 """
 tid=str(team['espn_id']);days={e.get('date','')[:10] for e in document.get('events',[])}
 count=0;byday=collections.Counter(row['date'] for row in rows)
 for row in rows:
  name=row['opponent'].strip();date=row['date']
  if date in days or byday[date]!=1 or row.get('exhibition'):continue
  if not re.fullmatch(r'2026-(?:10|11|12)-\d\d|2027-0[1-4]-\d\d',date):continue
  if re.search(r'\b(?:TBA|TBD|exhibition|winner|loser|tournament|championship|semifinal|quarterfinal|round|regional|final|finals|NCAA|NIT|CBI|scrimmage|practice|alumni)\b',name,re.I) or '/' in name:continue
  options=[t for t in TEAMS if norm(name) in {norm(t.get('name')),norm(t.get('espn_name'))}]
  opponent=options[0] if len(options)==1 else None
  if opponent and str(opponent['espn_id'])==tid:continue
  side=row['site'];known=side in ('home','away','neutral') and row.get('site_explicit',False)
  own={'homeAway':side or 'unknown','team':{'id':tid,'displayName':team.get('espn_name') or team['name']}}
  other={'homeAway':{'home':'away','away':'home','neutral':'neutral'}.get(side,'unknown'),'team':{'id':str(opponent['espn_id']) if opponent else '', 'displayName':(opponent.get('espn_name') or opponent['name']) if opponent else name}}
  venue={}
  if row['arena']:venue.update(arenaName=row['arena'],arena_source_url=source)
  if row['city']:venue.update(official_school_city=row['city'],city_source_url=source)
  competition={'competitors':[own,other],'venue':venue,'broadcasts':[{'names':[row['tv']],'source_url':source}] if row['tv'] else []}
  event={'id':f'official-{tid}-{date}-{norm(name)}','date':date+'T17:00:00Z','name':name,'competitions':[competition],'official_source':True,'school_source_url':source,'site_verified':known,'neutralSite':side=='neutral','status':{'type':{'state':'pre','completed':False,'shortDetail':'Scheduled'}}}
  if known:event['site_source_url']=source
  if row['time']:event.update(official_school_time=row['time'],official_school_time_source=source)
  if row['tv']:event['broadcast_source_url']=source
  document.setdefault('events',[]).append(event);days.add(date);count+=1
 document['events'].sort(key=lambda x:x.get('date',''))
 return count

def run(team):
 tid=str(team['espn_id']);p=DATA/'mbb-schedules-2026-27'/(tid+'.json')
 d=json.loads(p.read_text());url=d.get('source_url','')
 original_url=url
 if not url or 'sports-reference.com' in url:
  source_list=json.loads((DATA/'mbb-official-school-schedule-sources.json').read_text())['teams']
  url=next((x['url'] for x in source_list if str(x.get('espn_id'))==tid),'')
 if os.getenv('BULK_COMPLETION'):
  for filename in ['mbb-default-official-fields.json','mbb-wmt-official-fields.json']:
   previous=json.loads((DATA/filename).read_text())
   if tid in {x['id'] for x in previous['schools'] if x['status']=='parsed'}:
    url=re.sub(r'/schedule(?:/text)?(?:/[^/?]+)?/?$', '/schedule',url)
 if os.getenv('DEFAULT_PASS') or os.getenv('WMT_PASS'):
  url=re.sub(r'/schedule(?:/text)?(?:/[^/?]+)?/?$', '/schedule',url)
 if not os.getenv('TEXT_PASS'):url=url.replace('/schedule/text/','/schedule/')
 result=dict(id=tid,school=team['name'],rows=0,matched=0,fields=0,status='unsupported')
 if not url.startswith('https://') or any(x in (urlparse(url).hostname or '') for x in ['espn.com','realgm.com','wikipedia.org','sports-reference.com']):return result
 try:
  r=requests.get(url,timeout=18,headers={'User-Agent':'Mozilla/5.0'})
  if not r.ok or urlparse(r.url).hostname!=urlparse(url).hostname:return result
  rows=parse(r.text,(team['name'],team.get('espn_name','')));result['rows']=len(rows)
 except Exception as ex:result.update(status='fetch_failed',error=str(ex)[:100]);return result
 if not rows:return result
 result['status']='parsed'
 evidence=DATA/'mbb-official-game-evidence';evidence.mkdir(exist_ok=True)
 (evidence/(tid+'.json')).write_text(json.dumps({'source_url':r.url,'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows},ensure_ascii=False,separators=(',',':'))+'\n')
 if not original_url or 'sports-reference.com' in original_url:
  d['source_url']=r.url;result['fields']+=1
 for e in d.get('events',[]):
  c=e['competitions'][0];ps=c['competitors'];own=next((x for x in ps if str(x.get('team',{}).get('id'))==tid),None)
  if own is None:continue
  opp=next((x for x in ps if x is not own),{})
  names={norm(e.get('name')),norm(opp.get('team',{}).get('displayName'))}
  ot=next((t for t in TEAMS if str(t['espn_id'])==str(opp.get('team',{}).get('id'))),{})
  names.update(norm(ot.get(k)) for k in ['name','espn_name'])
  names.discard('')
  candidates=[x for x in rows if x['date']==e.get('date','')[:10] and norm(x['opponent']) in names]
  if len(candidates)!=1:continue
  row=candidates[0];result['matched']+=1
  def put(obj,key,val,source_key):
   if val and obj.get(key)!=val:
    obj[key]=val;obj[source_key]=r.url;result['fields']+=1
  v=c.setdefault('venue',{})
  put(v,'arenaName',row['arena'],'arena_source_url')
  put(v,'official_school_city',row['city'],'city_source_url')
  if row['time']:put(e,'official_school_time',row['time'],'official_school_time_source')
  if row['tv']:
   old=[n for b in c.get('broadcasts',[]) for n in b.get('names',[])]
   if old!=[row['tv']]:c['broadcasts']=[{'names':[row['tv']],'source_url':r.url}];result['fields']+=1
   e['broadcast_source_url']=r.url
  # An explicit away card can verify away; vs does not certify home/neutral.
  if row['site'] and (not e.get('site_verified') or (row.get('site_explicit') and own.get('homeAway')!=row['site'])):
   own['homeAway']=row['site'];opp['homeAway']={'away':'home','home':'away','neutral':'neutral'}[row['site']];e.update(site_verified=True,site_source_url=r.url,neutralSite=row['site']=='neutral');e.pop('site_conflict',None);result['fields']+=1
 if os.getenv('ADD_MISSING'):
  result['games_added']=add_missing_games(d,team,rows,r.url)
  result['fields']+=result['games_added']
 if result['fields']:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 return result
if __name__=='__main__':
 selected=TEAMS
 if os.getenv('BULK_COMPLETION'):
  supported=set()
  for filename in ['mbb-nextgen-official-fields.json','mbb-text-official-fields.json','mbb-default-official-fields.json','mbb-classic-official-fields.json','mbb-wmt-official-fields.json','mbb-missing-official-source-recovery.json']:
   supported.update(x['id'] for x in json.loads((DATA/filename).read_text())['schools'] if x['status']=='parsed')
  selected=[t for t in TEAMS if str(t['espn_id']) in supported]
 if os.getenv('WMT_PASS'):
  supported=set()
  for filename in ['mbb-nextgen-official-fields.json','mbb-text-official-fields.json','mbb-default-official-fields.json','mbb-classic-official-fields.json']:
   supported.update(x['id'] for x in json.loads((DATA/filename).read_text())['schools'] if x['status']=='parsed')
  selected=[t for t in TEAMS if str(t['espn_id']) not in supported]
 if os.getenv('CLASSIC_PASS'):
  previous=json.loads((DATA/'mbb-official-field-recovery-all-365.json').read_text())
  ids={x['id'] for x in previous['schools'] if x['status']=='read'}
  selected=[t for t in TEAMS if str(t['espn_id']) in ids]
 if os.getenv('SEMANTIC_PASS'):
  previous=json.loads((DATA/'mbb-nextgen-official-fields.json').read_text())
  ids={x['id'] for x in previous['schools'] if x['status']=='parsed'}
  selected=[t for t in TEAMS if str(t['espn_id']) in ids]
 if os.getenv('TEXT_PASS') or os.getenv('DEFAULT_PASS'):
  previous=json.loads((DATA/'mbb-nextgen-official-fields.json').read_text())
  ids={x['id'] for x in previous['schools'] if x['status']!='parsed'}
  if os.getenv('DEFAULT_PASS'):
   text=json.loads((DATA/'mbb-text-official-fields.json').read_text())
   ids-= {x['id'] for x in text['schools'] if x['status']=='parsed'}
  selected=[t for t in TEAMS if str(t['espn_id']) in ids]
 with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
  results=[]
  for result in pool.map(run,selected):
   results.append(result)
   if len(results)%25==0:print('Schools processed:',len(results),flush=True)
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':{'schools_checked':len(results),'schools_changed':sum(x['fields']>0 for x in results),'official_rows':sum(x['rows'] for x in results),'matched_games':sum(x['matched'] for x in results),'fields_updated':sum(x['fields'] for x in results),'statuses':dict(collections.Counter(x['status'] for x in results))},'schools':results}
 (DATA/('mbb-bulk-completion-pass.json' if os.getenv('BULK_COMPLETION') else 'mbb-wmt-official-fields.json' if os.getenv('WMT_PASS') else 'mbb-classic-official-fields.json' if os.getenv('CLASSIC_PASS') else 'mbb-semantic-official-fields.json' if os.getenv('SEMANTIC_PASS') else 'mbb-default-official-fields.json' if os.getenv('DEFAULT_PASS') else 'mbb-text-official-fields.json' if os.getenv('TEXT_PASS') else 'mbb-nextgen-official-fields.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary']),flush=True)

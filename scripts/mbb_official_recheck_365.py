#!/usr/bin/env python3
"""Verify all 365 NCAA MBB team schedules from the school athletics websites.
Only exact date + opponent matches may modify existing records.
"""
import json, re, pathlib, datetime, collections, time
from urllib.parse import urlsplit
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1]
teams=[t for t in json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')][:]
assert len(teams)==365
USER_AGENT='Mozilla/5.0 (compatible; SportingLifeTimesScheduleVerifier/1.0)'

def hostname(url):
 try:
  host=(urlsplit(str(url or '')).hostname or '').lower()
 except ValueError:return ''
 return host[4:] if host.startswith('www.') else host
OFFICIAL_HOST_BY_ID={}
for team in teams:
 try:
  tid=str(team['espn_id'])
  fp=root/'data/mbb-schedules-2026-27'/(tid+'.json')
  if fp.exists():
   host=hostname(json.loads(fp.read_text()).get('source_url'))
   if host and not host.endswith('espn.com'):OFFICIAL_HOST_BY_ID[tid]=host
 except (OSError,ValueError,TypeError):continue

def norm(s):return re.sub('[^a-z0-9]','',str(s or '').lower())
def datekey(raw):
 m=re.search(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b',raw,re.I)
 if not m:return ''
 t=re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)',raw,re.I).group(1).lower()[:3]
 month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].index(t)+1
 return f"{2026 if month>=7 else 2027}-{month:02d}-{int(m.group(1)):02d}"
def rows_from_school(html):
 soup=BeautifulSoup(html,'html.parser');out=[]
 for table in soup.find_all('table'):
  tr=table.find_all('tr')
  if not tr:continue
  head=[x.get_text(' ',strip=True).lower() for x in tr[0].find_all(['th','td'])]
  def col(term):return next((i for i,h in enumerate(head) if h==term),-1)
  datei,timei,ati,oppi,loci=[col(x) for x in ('date','time','at','opponent','location')]
  tv_col=next((i for i,h in enumerate(head) if h in ('tv','broadcast','network','tv/stream','tv / stream')), -1)
  if min(datei,ati,oppi,loci)<0:continue
  for row in tr[1:]:
   values=[x.get_text(' ',strip=True) for x in row.find_all(['td','th'])]
   if max(datei,ati,oppi,loci)>=len(values):continue
   date=datekey(values[datei]);site=values[ati].strip().lower()
   if date and site in ('home','away','neutral') and values[oppi]:
    out.append({'date':date,'site':site,'opponent':values[oppi],'location':values[loci],'time':values[timei] if timei>=0 and timei<len(values) else '', 'broadcast':values[tv_col] if tv_col>=0 and tv_col<len(values) else ''})
 return out

def rows_from_sidearm_cards(html):
 """Official Sidearm cards; 'vs' alone never certifies a home game."""
 soup=BeautifulSoup(html,'html.parser')
 found=[];seen=set()
 cards=soup.select('.sidearm-schedule-game[data-game-id],.sidearm-schedule-game-row[data-game-id],li.sidearm-schedule-game')
 for card in cards:
  el=card.select_one('.sidearm-schedule-game-opponent-text,.sidearm-schedule-game-opponent-name,[class*="schedule-game-opponent-name"]')
  if not el:continue
  m=re.match(r'^(at|vs\.?|@)\s+(.+?)\s*$',el.get_text(' ',strip=True),re.I)
  if not m:continue
  opponent=re.sub(r'\s*\((?:exh\.?|exhibition)\)\s*$','',m.group(2),flags=re.I).strip()
  if not 2<len(opponent)<125:continue
  de=card.select_one('.sidearm-schedule-game-opponent-date,.sidearm-schedule-game-date,[class*="schedule-game-date"]')
  day=datekey((de.get_text(' ',strip=True) if de else '') or card.get('data-date') or '')
  if not day:continue
  neutral=bool(card.select_one('.sidearm-schedule-game-neutral,[class*="neutral-site"]') or re.search(r'\bneutral\b',' '.join(card.get('class',[])),re.I))
  prefix=m.group(1).lower()
  site='neutral' if neutral else ('away' if prefix in ('at','@') else 'home')
  certified=neutral or prefix in ('at','@') or bool(card.select_one('.sidearm-schedule-game-home,[class*="home-game"]'))
  pl=card.select_one('.sidearm-schedule-game-location,.sidearm-schedule-game-opponent-location,[class*="schedule-game-venue"]')
  location=pl.get_text(' ',strip=True) if pl else ''
  clock=''
  for selector in ('.sidearm-schedule-game-time','.sidearm-schedule-game-opponent-time','.sidearm-schedule-game-opponent-date'):
   node=card.select_one(selector)
   if node:
    match=re.search(r'(?i)(?<![\d:])(?:[01]?\d(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)(?:\s+(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?(?!\w)',node.get_text(' ',strip=True))
    if match:clock=match.group(0).strip();break
  # A network is accepted only from this particular game's TV coverage
  # markup. Generic "Watch" links, radio tags, and page-wide TV promos
  # cannot identify a game's broadcaster.
  known_tv=re.compile(
   r"(?i)(?:ESPN(?:2|3|U|\+)?|ACCNX|ACC Network(?: Extra)?|SEC Network(?:\+)?|SECN\+?|"
   r"Big Ten Network|Big Ten Plus|B1G\+|BTN|FOX|FS1|FS2|CBS(?: Sports Network)?|CBSSN|"
   r"NBC|Peacock|The CW|CW|TNT|truTV|FloSports|FloHoops|SWAC TV|HBCU GO|"
   r"Mountain West Network|MW\+|WCC Network|Summit League Network|K5|ESPN\+)"
  )
  labels=[]
  for media in card.select(
   ".sidearm-schedule-game-coverage-tv-content,[class*='coverage-tv-content'],"
   "[class*='tv-network'],[class*='television'],"
   "[class*='broadcast-network'],[class*='game-network'],[class*='tv-logo']"
  ):
   if re.search(r'(?i)(?:radio|audio)'," ".join(media.get('class',[]))):continue
   labels.append(media.get_text(' ',strip=True))
   labels.extend(img.get('alt') or img.get('title') or '' for img in media.select('img[alt],img[title]'))
  networks=set()
  for value in labels:
   label=re.sub(r'\s+',' ',str(value or '').strip())
   label=re.sub(r'(?i)^(?:TV|Television|Network|Broadcast|Stream)\s*:\s*','',label).strip(' :-')
   if 1<len(label)<52 and known_tv.fullmatch(label):
    networks.add(label)
  broadcast=next(iter(networks)) if len(networks)==1 else ''
  key=(day,norm(opponent),site)
  if key in seen:continue
  seen.add(key)
  link=el.select_one('a[href]') or card.select_one('.sidearm-schedule-game-opponent-name a[href]')
  opponent_host=hostname(link.get('href','')) if link else ''
  found.append({'date':day,'site':site,'site_certified':bool(certified),'opponent':opponent,'opponent_host':opponent_host,'location':location,'time':clock,'broadcast':broadcast})
 return found


def rows_from_verified_conference_table(html):
 """Use explicit official conference calendar fields, never inferred TV."""
 soup=BeautifulSoup(html,'html.parser')
 out=[]
 for table in soup.select('table'):
  trs=table.select('tr')
  if not trs:continue
  heads=[x.get_text(' ',strip=True).lower() for x in trs[0].find_all(['th','td'],recursive=False)]
  needed=['date','team','home/away','result/time','location']
  if any(h not in heads for h in needed):continue
  positions=[heads.index(h) for h in needed]
  for tr in trs[1:]:
   cells=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'],recursive=False)]
   if len(cells)<=max(positions):continue
   date,opponent,site,time,location=[cells[i] for i in positions]
   if not re.fullmatch(r'\d{1,2}/\d{1,2}/202[67]',date):continue
   try:
    mo,day,year=map(int,date.split('/'))
    iso=datetime.date(year,mo,day).isoformat()
   except ValueError:continue
   side={'h':'home','a':'away','n':'neutral'}.get(site.lower().strip())
   if not side or not opponent.strip():continue
   # The conference may label an unannounced time TBA; do not promote it.
   clock=time.strip() if re.fullmatch(r'(?i)\d{1,2}(?::[0-5]\d)?\s*[ap]\.?m\.?',time.strip()) else ''
   out.append({'date':iso,'opponent':opponent.strip(),'site':side,'site_certified':True,
               'time':clock,'location':location.strip(),'broadcast':''})
 return out

def opponent_variants(x):
 x=str(x or '').lower()
 x=re.sub(r'\b(university|college|wildcats|bulldogs|tigers|eagles|bears|panthers|knights|crimson tide|zips|raiders|cardinals|cowboys|aggies|hawks|lions|rams|falcons|spartans|cougars|rebels|broncos|pirates|huskies|warriors)\b','',x)
 return norm(x)
results=[];totals=collections.Counter()
def verify_team(team):
 tid=str(team['espn_id']);path=root/'data/mbb-schedules-2026-27'/(tid+'.json')
 item={'team':team['name'],'id':tid,'status':'unavailable','matched':0,'site_corrected':0,'location_corrected':0,'school_rows':0}
 if not path.exists():item['status']='missing_file';return item
 d=json.loads(path.read_text());original=json.loads(json.dumps(d));url=d.get('source_url') or d.get('official_conference_schedule_url','')
 if not url or not url.startswith('https://'):item['status']='no_official_source';return item
 try:
  candidates=[url]
  if '/schedule/text/' in url:
   candidates.append(url.replace('/schedule/text/','/schedule/'))
   candidates.append(url.replace('/schedule/text/','/schedule/').replace('/2026-27','/2026'))
  if '/schedule/' in url and '/schedule/text/' not in url:
   candidates.append(url.replace('/schedule/','/schedule/text/'))
  school=[]
  for candidate in dict.fromkeys(candidates):
   try:
    response=requests.get(candidate,timeout=(4,6),headers={'User-Agent':USER_AGENT});response.raise_for_status()
    school=rows_from_school(response.text)
    method='table'
    if not school and candidate==d.get('official_conference_schedule_url'):
     school=rows_from_verified_conference_table(response.text)
     method='official_conference'
    if not school:
     school=rows_from_sidearm_cards(response.text)
     method='sidearm_card'
    if school:
     url=candidate
     item['source_method']=method
     break
   except requests.RequestException:continue
  if not school:raise ValueError('No readable official schedule table at available source URLs')
 except Exception as exc:
  item['status']='source_fetch_failed';item['detail']=str(exc)[:120];return item
 item['school_rows']=len(school)
 if not school:item['status']='source_table_unreadable';return item
 lookup=collections.defaultdict(list)
 for row in school:
  lookup[row['date']].append(row)
 for event in d.get('events',[]):
  date=str(event.get('date',''))[:10];comp=(event.get('competitions') or [{}])[0]
  ps=comp.get('competitors') or []
  selfrow=next((p for p in ps if str((p.get('team') or {}).get('id'))==tid),None)
  opp=next((p for p in ps if p is not selfrow),None)
  if not selfrow or not opp:continue
  opname=(opp.get('team') or {}).get('displayName') or (opp.get('team') or {}).get('name') or event.get('name','')
  opponent_id=str((opp.get('team') or {}).get('id') or '')
  opponent_host=OFFICIAL_HOST_BY_ID.get(opponent_id,'')
  eligible=[x for x in lookup.get(date,[]) if norm(x['opponent'])==norm(opname) or (opponent_variants(x['opponent']) and opponent_variants(x['opponent'])==opponent_variants(opname)) or (bool(opponent_host) and bool(x.get('opponent_host')) and x['opponent_host']==opponent_host)]
  if len(eligible)!=1:continue
  row=eligible[0];item['matched']+=1
  site=row['site']
  if row.get('site_certified',True) and (selfrow.get('homeAway')!=site or not event.get('site_verified')):
   if event.get('site_verified') is True and selfrow.get('homeAway')!=site:
    item['site_conflicts']=item.get('site_conflicts',0)+1
   else:
    selfrow['homeAway']=site
    opp['homeAway']='away' if site=='home' else 'home' if site=='away' else 'neutral'
    event['neutralSite']=site=='neutral';event['site_verified']=True
    event['site_source_url']=url;item['site_corrected']+=1
  loc=row['location'].strip()
  if loc:
   venue=comp.setdefault('venue',{})
   if not venue.get('official_school_location'):
    venue['official_school_location']=loc
    venue['source_url']=url;item['location_corrected']+=1
   paren=re.search(r'\(([^()]+)\)',loc)
   if paren and not venue.get('arenaName') and re.search(r'Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium',paren.group(1),re.I):
    venue['arenaName']=paren.group(1).strip();venue['arena_source_url']=url
    item['arena_added']=item.get('arena_added',0)+1
  # Add TV only when an official table explicitly names a channel; never infer from league packages.
  broadcast=row.get('broadcast','').strip()
  if broadcast and broadcast.lower() not in ('tba','tbd','none','watch','live stats','--') and not (comp.get('broadcasts') or event.get('broadcasts')):
   comp['broadcasts']=[{'names':[broadcast],'source_url':url}]
   item['broadcast_added']=item.get('broadcast_added',0)+1
  # The school page may contain date labels masquerading as tipoff clocks.
  school_clock=str(row.get('time') or '').strip()
  prior_clock=str(event.get('official_school_time') or event.get('official_time') or '').strip()
  real_clock=lambda t: bool(re.fullmatch(r'(?i)(?:(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)(?:\s+(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?',t.strip()))
  if real_clock(school_clock) and not real_clock(prior_clock):
   event['official_school_time']=school_clock;event['official_school_time_source']=url;
   item['tipoff_added']=item.get('tipoff_added',0)+1
 if item['matched'] and d != original:
  path.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
  item['status']='verified_changes'
 elif item['matched']:item['status']='already_matched'
 else:item['status']='no_safe_matches'
 return item
with ThreadPoolExecutor(max_workers=12) as pool:
 futures=[pool.submit(verify_team,t) for t in teams]
 for future in as_completed(futures):
  item=future.result()
  results.append(item)
  totals.update({k:item.get(k,0) for k in ('matched','site_corrected','site_conflicts','location_corrected','arena_added','broadcast_added','tipoff_added')})
results.sort(key=lambda x:x['team'])
report={'schools_targeted':365,'schools_checked':len(results),'totals':dict(totals),'status_counts':dict(collections.Counter(x['status'] for x in results)),'source_method_counts':dict(collections.Counter(x.get('source_method','unreadable') for x in results)),'schools':results}
(root/'data/mbb-official-recheck-365-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='schools'},indent=2))

# 365-SCHOOL RECIPROCAL SOURCE RECONCILIATION, 2026-27
# Use the existing official records as a game ledger before requesting any new web data.
# Preserve every original event ID and all independently announced valid fields.
import urllib.parse
team_records={}
known_ids={str(t['espn_id']) for t in teams}
for team in teams:
 tid=str(team['espn_id']);p=root/'data/mbb-schedules-2026-27'/(tid+'.json')
 if p.exists():team_records[tid]=(p,json.loads(p.read_text()))
assert len(team_records)==365, 'All 365 school schedule files are required for the reciprocal audit'
def good_url(value):
 try:
  u=urllib.parse.urlsplit(str(value or ''))
  return u.scheme=='https' and bool(u.netloc) and not re.search(r'(^|\.)api\.espn\.com$',u.hostname or '')
 except ValueError:return False
def good_clock(value):
 return bool(re.fullmatch(r'(?i)(?:(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)(?:\s+(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?',str(value or '').strip()))
def explicit_zone(value):
 m=re.search(r'\b(ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b',str(value or ''),re.I)
 return m.group(1).upper() if m else ''
def usable_time(e,d):
 t=str(e.get('official_school_time') or '').strip()
 if not good_clock(t):return None
 source=e.get('official_school_time_source') or e.get('school_source_url') or d.get('source_url')
 if not good_url(source):return None
 zone=explicit_zone(t) or explicit_zone(e.get('official_time_zone')) or explicit_zone(d.get('official_time_zone'))
 if not zone:return None
 return (t if explicit_zone(t) else t+' '+zone),source
def net_values(e):
 c=(e.get('competitions') or [{}])[0];found=[]
 for b in (c.get('broadcasts') or [])+(e.get('broadcasts') or []):
  if isinstance(b,str):continue
  if not isinstance(b,dict):continue
  names=b.get('names') or ([b['name']] if b.get('name') else [])
  if isinstance(names,str):names=[names]
  names=[str(n).strip() for n in names if str(n).strip()]
  names=[n for n in names if not re.search(r'(?i)\b(TBA|TBD|wild\s*card|or\s+ESPNU|unknown|unannounced)\b',n)]
  src=b.get('source_url') or ''
  if names and good_url(src):
   found.append((tuple(names),src))
 return found
def has_network(e):
 c=(e.get('competitions') or [{}])[0]
 return bool(c.get('broadcasts') or e.get('broadcasts') or e.get('broadcast'))
def clean_arena(v):
 value=str(v.get('arenaName') or '').strip()
 if re.search(r'(?i)^(TBA|TBD|unknown|choose a location)$',value):return ''
 if re.search(r'(?i)^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d',value):return ''
 if not re.search(r'(?i)(arena|center|centre|coliseum|pavilion|fieldhouse|forum|gymnasium|auditorium|stadium|dome|court|complex|hall|palace|convocation|gym\b)',value):return ''
 return value
def clean_city(v):
 city=str(v.get('official_school_city') or '').strip()
 if not city:
  a=v.get('address') or {}
  city=str(a.get('city') or '').strip()
  state=str(a.get('state') or '').strip()
  if city and state:city+=', '+state
 if re.search(r'(?i)^(TBA|TBD|unknown|choose a location)$',city):return ''
 if re.search(r'(?i)^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+',city):return ''
 return city
ledger=collections.defaultdict(list)
reciprocal=collections.Counter();seen_changes=[];conflicts=[]
for owner,(p,d) in team_records.items():
 for event in d.get('events',[]):
  c=(event.get('competitions') or [{}])[0]
  competitors=c.get('competitors') or []
  if len(competitors)!=2:continue
  ids=[str((x.get('team') or {}).get('id') or '') for x in competitors]
  if owner not in ids or any(x not in known_ids for x in ids) or ids[0]==ids[1]:continue
  day=str(event.get('date') or '')[:10]
  if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',day):continue
  ledger[(day,tuple(sorted(ids)))].append((owner,event))
changed_schools=set()
def issue(day,pair,kind,details):
 reciprocal['conflicts_'+kind]+=1
 if len(conflicts)<250:conflicts.append({'date':day,'schools':list(pair),'kind':kind,'details':details})
for (day,pair),matches in sorted(ledger.items()):
 if len(matches)!=2 or matches[0][0]==matches[1][0]:
  reciprocal['ambiguous_or_nonreciprocal_groups']+=1;continue
 left,right=matches
 aowner,ae=left;bowner,be=right
 ac=(ae.get('competitions') or [{}])[0];bc=(be.get('competitions') or [{}])[0]
 def side(event,owner):
  c=(event.get('competitions') or [{}])[0]
  return next((x.get('homeAway') for x in c.get('competitors') or [] if str((x.get('team') or {}).get('id'))==owner),'')
 a,b=side(ae,aowner),side(be,bowner)
 expected={'home':'away','away':'home','neutral':'neutral'}
 if (ae.get('site_verified') is not True or be.get('site_verified') is not True
     or a not in expected or expected[a]!=b):
  issue(day,pair,'site_mismatch_or_unverified',{'left':a,'right':b});continue
 reciprocal['unique_verified_reciprocal_games']+=1
 # Flag contradictions without overwriting either university's explicitly sourced record.
 for target,source in ((left,right),(right,left)):
  owner,te=target;sowner,se=source
  tc=(te.get('competitions') or [{}])[0];sc=(se.get('competitions') or [{}])[0]
  td=team_records[owner][1];sd=team_records[sowner][1]
  changed=[]
  tnet=net_values(te);snet=net_values(se)
  if tnet and snet and sorted(set(n for group,_ in tnet for n in group))!=sorted(set(n for group,_ in snet for n in group)):
   issue(day,pair,'broadcast_disagreement',{'left':[n for v,_ in tnet for n in v],'right':[n for v,_ in snet for n in v]})
  elif not has_network(te) and len(snet)==1:
   labels,url=snet[0]
   tc['broadcasts']=[{'names':list(labels),'source_url':url,'verified_via':'reciprocal_official_2026_27'}]
   changed.append('broadcast')
  stime=usable_time(se,sd)
  ttime=usable_time(te,td)
  if stime and ttime and stime[0].lower()!=ttime[0].lower() and explicit_zone(stime[0])==explicit_zone(ttime[0]):
   issue(day,pair,'time_disagreement',{'target':ttime[0],'source':stime[0]})
  if stime and not good_clock(te.get('official_school_time')) and not good_clock(te.get('official_time')):
   te['official_school_time']=stime[0]
   te['official_school_time_source']=stime[1]
   te['official_school_time_verified_via']='reciprocal_official_2026_27'
   changed.append('tipoff')
  tv=tc.setdefault('venue',{});sv=sc.get('venue') or {}
  arena=clean_arena(sv);t_arena=clean_arena(tv)
  vsource=sv.get('arena_source_url') or sv.get('source_url') or se.get('school_source_url') or sd.get('source_url')
  if arena and not t_arena and good_url(vsource):
   tv['arenaName']=arena;tv['arena_source_url']=vsource
   if not clean_arena({'arenaName':tv.get('fullName')}):tv['fullName']=arena
   changed.append('arena')
  elif arena and t_arena and arena.lower()!=t_arena.lower() and good_url(vsource):
   issue(day,pair,'arena_disagreement',{'target':t_arena,'source':arena})
  city=clean_city(sv);targetcity=clean_city(tv)
  csource=sv.get('city_source_url') or sv.get('source_url') or sd.get('source_url')
  if city and not targetcity and good_url(csource):
   tv['official_school_city']=city;tv['city_source_url']=csource
   changed.append('city')
  if changed:
   reciprocal['game_records_repaired']+=1;changed_schools.add(owner)
   reciprocal.update(changed)
   seen_changes.append({'school_id':owner,'opponent_id':sowner,'date':day,'event_id':te.get('id'),'fields':changed,'source_url':stime[1] if 'tipoff' in changed else (snet[0][1] if 'broadcast' in changed else (vsource if 'arena' in changed else csource))})
for sid in changed_schools:
 p,d=team_records[sid]
 p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
reciprocal['schools_scanned']=len(team_records)
reciprocal['schools_changed']=len(changed_schools)
reciprocal['all_game_entries']=sum(len(d.get('events') or []) for _,d in team_records.values())
# Fresh post-merge audit: actual visible-field completeness, not old count snapshots.
for owner,(p,d) in team_records.items():
 for e in d.get('events',[]):
  c=(e.get('competitions') or [{}])[0];v=c.get('venue') or {}
  if not good_clock(e.get('official_school_time')) and not good_clock(e.get('official_time')):reciprocal['remaining_missing_tipoff']+=1
  if not has_network(e):reciprocal['remaining_missing_broadcast']+=1
  if not clean_arena(v):reciprocal['remaining_missing_valid_arena']+=1
  if not clean_city(v):reciprocal['remaining_missing_city']+=1
  if e.get('site_verified') is not True:reciprocal['remaining_unverified_site']+=1
verification_path=root/'data/mbb-official-recheck-365-verification.json'
verification=json.loads(verification_path.read_text())
verification['reciprocal_pass']={
 'summary':dict(reciprocal),
 'policy':'Source links and unique exact-day D-I opponent ID pairs; never overwrite an announced clock/channel; valid arena excludes date labels; conflicts quarantined; no generic TV assignments.',
 'conflicts':conflicts,
 'changes':seen_changes
}
verification_path.write_text(json.dumps(verification,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'365_school_reciprocal_pass':dict(reciprocal),'conflict_samples':len(conflicts)},indent=2))

# Complete the same single-pass recovery from all eight verified official
# conference and broadcaster game ledgers, without adding a new workflow. This runs offline and does not refetch school sites.
from mbb_cached_network_recovery import recover as recover_cached_networks
cached_summary = recover_cached_networks()
print(json.dumps({'official_broadcast_recovery':cached_summary}, indent=2))

# University newsroom releases cover WMT/modern pages that do not expose
# the traditional Sidearm game cards. Preserve dual national/regional broadcasts.
from mbb_apply_reviewed_announcements import execute as apply_reviewed_announcements
reviewed_result = apply_reviewed_announcements()
print(json.dumps({'reviewed_official_announcements':reviewed_result['summary']}, indent=2))

# The game-coverage audit is read-only. Missing counterpart fixtures must be
# confirmed independently before any new game ID or calendar entry is created.
from mbb_reciprocal_game_gap_audit import run as audit_reciprocal_game_gaps
coverage = audit_reciprocal_game_gaps()
print(json.dumps({'reciprocal_fixture_coverage':coverage['summary']}, indent=2))




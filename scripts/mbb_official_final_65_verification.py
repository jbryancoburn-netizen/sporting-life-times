#!/usr/bin/env python3
"""Verify first 100 NCAA MBB team schedules from the school athletics websites.
Only exact date + opponent matches may modify existing records.
"""
import json, re, pathlib, datetime, collections, time
import requests
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1]
teams=[t for t in json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')][300:365]
assert len(teams)==65
client=requests.Session();client.headers.update({'User-Agent':'Mozilla/5.0 (compatible; SportingLifeTimesScheduleVerifier/1.0)'})
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
  if min(datei,ati,oppi,loci)<0:continue
  for row in tr[1:]:
   values=[x.get_text(' ',strip=True) for x in row.find_all(['td','th'])]
   if max(datei,ati,oppi,loci)>=len(values):continue
   date=datekey(values[datei]);site=values[ati].strip().lower()
   if date and site in ('home','away','neutral') and values[oppi]:
    out.append({'date':date,'site':site,'opponent':values[oppi],'location':values[loci],'time':values[timei] if timei>=0 and timei<len(values) else ''})
 return out
def opponent_variants(x):
 x=str(x or '').lower()
 x=re.sub(r'\b(university|college|wildcats|bulldogs|tigers|eagles|bears|panthers|knights|crimson tide|zips|raiders|cardinals|cowboys|aggies|hawks|lions|rams|falcons|spartans|cougars|rebels|broncos|pirates|huskies|warriors)\b','',x)
 return norm(x)
results=[];totals=collections.Counter()
for team in teams:
 tid=str(team['espn_id']);path=root/'data/mbb-schedules-2026-27'/(tid+'.json')
 item={'team':team['name'],'id':tid,'status':'unavailable','matched':0,'site_corrected':0,'location_corrected':0,'school_rows':0}
 if not path.exists():item['status']='missing_file';results.append(item);continue
 d=json.loads(path.read_text());url=d.get('source_url','')
 if not url or not url.startswith('https://'):item['status']='no_official_source';results.append(item);continue
 try:
  candidates=[url]
  if '/schedule/text/' in url:
   candidates.append(url.replace('/schedule/text/','/schedule/'))
  if '/schedule/' in url and '/schedule/text/' not in url:
   candidates.append(url.replace('/schedule/','/schedule/text/'))
  school=[]
  for candidate in dict.fromkeys(candidates):
   try:
    response=client.get(candidate,timeout=10);response.raise_for_status()
    school=rows_from_school(response.text)
    if school:
     url=candidate
     break
   except requests.RequestException:continue
  if not school:raise ValueError('No readable official schedule table at available source URLs')
 except Exception as exc:
  item['status']='source_fetch_failed';item['detail']=str(exc)[:120];results.append(item);continue
 item['school_rows']=len(school)
 if not school:item['status']='source_table_unreadable';results.append(item);continue
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
  eligible=[x for x in lookup.get(date,[]) if norm(x['opponent'])==norm(opname) or (opponent_variants(x['opponent']) and opponent_variants(x['opponent'])==opponent_variants(opname))]
  if len(eligible)!=1:continue
  row=eligible[0];item['matched']+=1
  site=row['site']
  if selfrow.get('homeAway')!=site or not event.get('site_verified'):
   selfrow['homeAway']=site
   opp['homeAway']='away' if site=='home' else 'home' if site=='away' else 'neutral'
   event['neutralSite']=site=='neutral';event['site_verified']=True
   event['site_source_url']=url;item['site_corrected']+=1
  loc=row['location'].strip()
  if loc:
   venue=comp.setdefault('venue',{})
   if venue.get('official_school_location')!=loc:
    venue['official_school_location']=loc
    venue['source_url']=url;item['location_corrected']+=1
   paren=re.search(r'\(([^()]+)\)',loc)
   if paren and re.search(r'Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium',paren.group(1),re.I):
    venue['arenaName']=paren.group(1).strip()
  # School local tipoff stored separately; do not mislabel CT as ET.
  if row['time'] and 'TBD' not in row['time'].upper() and 'TBA' not in row['time'].upper():
   event['official_school_time']=row['time'];event['official_school_time_source']=url
 if item['matched']:
  path.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
  item['status']='verified_matches'
 else:item['status']='no_safe_matches'
 totals.update({k:item[k] for k in ('matched','site_corrected','location_corrected')})
 results.append(item)
report={'schools_targeted':65,'schools_checked':len(results),'totals':dict(totals),'status_counts':dict(collections.Counter(x['status'] for x in results)),'method':'Fetched official university athletics schedule text pages; applied only unique date + opponent matches; never guessed arena, broadcast, or timezone','schools':results}
(root/'data/mbb-official-final-65-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='schools'},indent=2))

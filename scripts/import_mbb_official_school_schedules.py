#!/usr/bin/env python3
"""Import verified school-athletics MBB schedules as the authoritative source.

Only rows representing a named confirmed opponent are imported. No exhibitions,
conditional tournament opponents, or generic future tournament rounds.
"""
import concurrent.futures,datetime,json,pathlib,re,urllib.request
from bs4 import BeautifulSoup

ROOT=pathlib.Path(__file__).resolve().parents[1]
src=json.loads((ROOT/'data/mbb-official-school-schedule-sources.json').read_text())
cross=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
out=ROOT/'data/mbb-schedules-2026-27'
out.mkdir(exist_ok=True)
by_espn={str(x['espn_id']):x for x in cross}
names={}
def norm(s):
 s=re.sub(r'\([^)]*\)','',s or '')
 s=re.sub(r'\b(university|college|the|of)\b','',s,flags=re.I)
 return re.sub('[^a-z0-9]','',s.casefold())
for t in cross:
 for n in [t['name'],t.get('espn_name','')]:
  k=norm(n)
  if k:names.setdefault(k,[]).append(t)
aliases={'uconn':'connecticut','pennsylvania':'penn','southerncalifornia':'usc','michiganstate':'michiganst','ohstate':'ohiost','ncarolina':'northcarolina'}
def getteam(label):
 k=aliases.get(norm(label),norm(label))
 options={x['id']:x for x in names.get(k,[])}
 if len(options)==1:return next(iter(options.values()))
 # Names may include mascots; school name must begin unambiguously.
 options={x['id']:x for n,ts in names.items() if len(k)>4 and (n==k or (n.startswith(k) and len(n)-len(k)>3)) for x in ts}
 return next(iter(options.values())) if len(options)==1 else None

def fetch(school):
 url=school['url']
 candidates_urls=[url]
 if '/schedule/text/2026-27' in url:
  candidates_urls.extend([url.replace('/schedule/text/2026-27','/schedule/2026-27'),url.replace('/schedule/text/2026-27','/schedule/text'),url.replace('/schedule/text/2026-27','/schedule')])
 raw=None
 for candidate in candidates_urls:
  try:
   req=urllib.request.Request(candidate,headers={'User-Agent':'Mozilla/5.0 (compatible; SportingLifeTimes/1.0; school schedule indexing)','Accept':'text/html'})
   with urllib.request.urlopen(req,timeout=12) as r:raw=r.read()
   if raw:break
  except Exception:continue
 if raw is None:raise ValueError('No accessible schedule route on official athletics host')
 soup=BeautifulSoup(raw,'html.parser')
 candidates=[]
 for table in soup.select('table'):
  heads=[' '.join(e.stripped_strings).lower() for e in table.select('thead th')]
  rows=table.select('tbody tr') or table.select('tr')
  if not any('opponent' in h for h in heads):continue
  order={c:i for i,h in enumerate(heads) for c in ['date','time','at','opponent','location','tournament','result'] if c in h}
  for tr in rows:
   cols=[' '.join(e.stripped_strings) for e in tr.find_all(['td'],recursive=False)]
   if len(cols)<5:continue
   entry={key:cols[i] for key,i in order.items() if i<len(cols)}
   if entry.get('opponent'):candidates.append(entry)
 return candidates

def convert(school,entry,idx):
 name=entry.get('opponent','').strip()
 if not name:return None
 if re.search(r'\b(exhibition|\(ex\)|if qualified|semifinal|placement game|tournament|final four|championship|opening round|regional|quarterfinal|first round|second round|third round)\b',name,re.I):return None
 if '/' in name or re.search(r'\b(TBD|TBA|winner of|to be determined)\b',name,re.I):return None
 date=entry.get('date','')
 m=re.search(r'\b(Jan|Feb|Mar|Apr|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b',date,re.I)
 if not m:return None
 month={'jan':1,'feb':2,'mar':3,'apr':4,'oct':10,'nov':11,'dec':12}[m.group(1).lower()]
 year=2026 if month>=10 else 2027
 dt=datetime.date(year,month,int(m.group(2))).isoformat()
 place=entry.get('location','').strip()
 site=entry.get('at','').strip().lower()
 if site not in ('home','away','neutral'):site='neutral'
 other=getteam(name)
 own=by_espn[str(school['espn_id'])]
 def competitor(t,home):
  return {'homeAway':home,'team':{'id':str(t['espn_id']) if t else '', 'displayName':t.get('espn_name',t['name']) if t else name,
    'logo':f"https://a.espncdn.com/i/teamlogos/ncaa/500/{t['espn_id']}.png" if t else ''}}
 opponent=competitor(other,'away' if site=='home' else 'home' if site=='away' else 'neutral')
 ownteam=competitor(own,'home' if site=='home' else 'away' if site=='away' else 'neutral')
 return {'id':'school-'+str(school['espn_id'])+'-'+dt+'-'+str(idx),
   'date':dt+'T12:00:00-05:00','official_time':entry.get('time','TBA'),
   'name':name,'school_source_url':school['url'],'neutralSite':site=='neutral',
   'competitions':[{'competitors':[ownteam,opponent],'venue':{'fullName':place},'broadcasts':[]}],
   'official_source':True}

def collect(school):
 try:
  entries=fetch(school)
  events=[x for i,e in enumerate(entries) if (x:=convert(school,e,i))]
  current=out/(str(school['espn_id'])+'.json')
  if current.exists():
   try:
    previous=json.loads(current.read_text())
    if previous.get('source_name')=='Indiana University Athletics official 2026-27 schedule' and len(previous.get('events',[]))>=len(events):
     return {'team':school['team'],'status':'official-preserved','confirmed_games':len(previous['events']),'url':school['url']}
   except (OSError,ValueError):pass
  if len(events)<20:
   return {'team':school['team'],'status':'unverified-too-few-games','parsed_rows':len(entries),'confirmed_games':len(events),'url':school['url']}
  payload={'season':'2026-27','team_id':by_espn[str(school['espn_id'])]['id'],
     'espn_team_id':str(school['espn_id']),'source_name':'Official university athletics 2026-27 schedule',
     'source_url':school['url'],'verified_from_school':True,'fetched_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'events':events}
  current.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
  return {'team':school['team'],'status':'verified-official','parsed_rows':len(entries),'confirmed_games':len(events),'url':school['url']}
 except Exception as e:
  return {'team':school['team'],'status':'error','error':str(e)[:250],'url':school['url']}
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:results=list(pool.map(collect,src['teams']))
report={'attempted_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,
 'official_verified':sum(x['status']=='verified-official' for x in results)}
(out/'official-school-sources-status.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if not report['official_verified']:raise SystemExit('No official school schedules verified; see report')

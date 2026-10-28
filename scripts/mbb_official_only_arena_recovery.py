#!/usr/bin/env python3
"""Official-school-only arena extraction. Never use RealGM, ESPN, or secondary venue directories."""
import json,pathlib,re,collections,requests,urllib.parse,concurrent.futures
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1];base=root/'data'
p=base/'mbb-arena-registry.json';reg=json.loads(p.read_text())
cross=json.loads((base/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
pat=re.compile(r'\b(?:arena|center|centre|coliseum|pavilion|fieldhouse|gymnasium|auditorium)\b',re.I)
def candidate(text):
 text=re.sub(r'\s+',' ',text).strip()
 m=re.search(r'\(([^()]{5,80})\)',text)
 if m and pat.search(m.group(1)):return m.group(1).strip()
 m=re.search(r'\s/\s([^/]{5,80})$',text)
 if m and pat.search(m.group(1)):return m.group(1).strip()
 return None
def run(t):
 tid=str(t.get('espn_id',''));arena=reg['teams'].get(tid)
 if not arena or arena.get('home_arena'):return None
 file=base/'mbb-schedules-2026-27'/(tid+'.json')
 if not file.exists():return {'id':tid,'school':t['name'],'status':'no_schedule_file'}
 data=json.loads(file.read_text());source=data.get('source_url','')
 if not source.startswith('https://'):return {'id':tid,'school':t['name'],'status':'no_official_school_url'}
 domain=urllib.parse.urlparse(source).hostname or ''
 if not domain or domain in ('www.espn.com','basketball.realgm.com'):return {'id':tid,'school':t['name'],'status':'not_official_source'}
 urlset=[source]
 if '/schedule/text/' in source:urlset.append(source.replace('/schedule/text/','/schedule/'))
 if '/schedule/' in source and '/schedule/text/' not in source:urlset.append(source.replace('/schedule/','/schedule/text/'))
 evidence=collections.defaultdict(set);attempts=[]
 for url in dict.fromkeys(urlset):
  try:
   res=requests.get(url,timeout=12,headers={'User-Agent':'Mozilla/5.0'},allow_redirects=True)
   finaldomain=urllib.parse.urlparse(res.url).hostname or ''
   if not res.ok or not (finaldomain==domain or finaldomain.endswith('.'+domain) or domain.endswith('.'+finaldomain)):
    attempts.append({'url':url,'status':res.status_code});continue
   soup=BeautifulSoup(res.text,'html.parser')
   for table in soup.find_all('table'):
    trs=table.find_all('tr')
    if not trs:continue
    heads=[x.get_text(' ',strip=True).lower() for x in trs[0].find_all(['th','td'])]
    hi=next((i for i,h in enumerate(heads) if h in ('at','site','home/away')),-1)
    li=next((i for i,h in enumerate(heads) if h in ('location','venue')),-1)
    if hi<0 or li<0:continue
    for tr in trs[1:]:
     cells=[x.get_text(' ',strip=True) for x in tr.find_all(['td','th'])]
     if max(hi,li)>=len(cells) or cells[hi].strip().lower()!='home':continue
     name=candidate(cells[li])
     if name:evidence[name].add(cells[li])
   attempts.append({'url':url,'status':res.status_code,'arena_candidates':list(evidence)})
  except Exception as exc:attempts.append({'url':url,'error':str(exc)[:120]})
 if evidence:
  counts={k:len(v) for k,v in evidence.items()}
  name=max(counts,key=counts.get)
  if counts[name]>=2 and counts[name]>sum(counts.values())/2:
   return {'id':tid,'school':t['name'],'status':'official_verified','arena':name,'source_url':source,'distinct_home_locations':counts[name],'attempts':attempts}
 return {'id':tid,'school':t['name'],'status':'no_repeated_named_home_arena','attempts':attempts}
missing=[t for t in cross if str(t.get('espn_id','')) in reg['teams'] and not reg['teams'][str(t['espn_id'])].get('home_arena')]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(run,missing))
status=collections.Counter()
for x in results:
 if not x:continue
 status[x['status']]+=1
 if x['status']=='official_verified':
  item=reg['teams'][x['id']]
  item.update(home_arena=x['arena'],home_arena_source=x['source_url'],home_arena_source_type='official_university_2026_27_home_game_table',verified_at='2026-10-28')
p.write_text(json.dumps(reg,indent=2)+'\n')
report={'source_policy':'OFFICIAL UNIVERSITY ATHLETICS SITES ONLY. No RealGM/secondary directories.','targeted':len(missing),'status_counts':dict(status),'total_confirmed':sum(bool(x.get('home_arena')) for x in reg['teams'].values()),'schools':results}
(base/'mbb-official-only-arena-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='schools'},indent=2))

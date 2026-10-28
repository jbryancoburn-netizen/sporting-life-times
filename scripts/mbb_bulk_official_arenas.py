#!/usr/bin/env python3
"""Bulk derive home arenas only from 2026-27 official athletics schedule table locations."""
import json,re,pathlib,requests,collections
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1];base=root/'data'
arena_file=base/'mbb-arena-registry.json';arenas=json.loads(arena_file.read_text())
teams=json.loads((base/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
session=requests.Session();session.headers['User-Agent']='Mozilla/5.0'
facility_pattern=re.compile(r'\b(?:Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Auditorium|Gym|Hinkle Fieldhouse|The Pit)\b',re.I)
def rows(html):
 soup=BeautifulSoup(html,'html.parser');out=[]
 for table in soup.find_all('table'):
  trs=table.find_all('tr')
  if not trs:continue
  headers=[x.get_text(' ',strip=True).lower() for x in trs[0].find_all(['th','td'])]
  def col(k):return next((i for i,v in enumerate(headers) if v==k),-1)
  h,loc=col('at'),col('location')
  if h<0 or loc<0:continue
  for tr in trs[1:]:
   t=[c.get_text(' ',strip=True) for c in tr.find_all(['td','th'])]
   if max(h,loc)<len(t) and t[h].lower()=='home' and t[loc]:out.append(t[loc])
 return out
report=[];stats=collections.Counter()
for t in teams:
 tid=str(t.get('espn_id',''))
 if tid not in arenas['teams'] or arenas['teams'][tid].get('home_arena'):continue
 p=base/'mbb-schedules-2026-27'/(tid+'.json')
 if not p.exists():continue
 obj=json.loads(p.read_text());source=obj.get('source_url','')
 record={'school':t['name'],'id':tid,'status':'unresolved'}
 if not source.startswith('https://'):
  record['status']='no_official_url';report.append(record);stats[record['status']]+=1;continue
 candidates=[source]
 if '/schedule/text/' in source:candidates.append(source.replace('/schedule/text/','/schedule/'))
 if '/schedule/' in source and '/schedule/text/' not in source:candidates.append(source.replace('/schedule/','/schedule/text/'))
 locs=[];successful=''
 for url in dict.fromkeys(candidates):
  try:
   response=session.get(url,timeout=9)
   if not response.ok:continue
   locs=rows(response.text)
   if locs:successful=url;break
  except requests.RequestException:pass
 if not locs:
  record['status']='unreadable_official_schedule';report.append(record);stats[record['status']]+=1;continue
 counts=collections.Counter()
 for location in locs:
  # Sidearm text schedules typically render "City, ST / Arena" or "City, ST (Arena)".
  match=re.search(r'\s/\s([^/]+)$',location) or re.search(r'\(([^()]+)\)',location)
  if not match:continue
  name=match.group(1).strip()
  if facility_pattern.search(name) and len(name)<90:counts[name]+=1
 if counts:
  best,n=counts.most_common(1)[0]
  # Require repeated explicit home listings and a dominant arena. Avoid guessing from one-off locations.
  if n>=2 and n>=sum(counts.values())*.6:
   arenas['teams'][tid]['home_arena']=best
   arenas['teams'][tid]['home_arena_source']=successful
   arenas['teams'][tid]['home_arena_source_type']='official_2026_27_schedule_home_rows'
   record.update(status='official_schedule_verified',arena=best,home_rows=n)
  else:record.update(status='ambiguous_arena_candidates',candidates=dict(counts))
 else:record['status']='no_named_facility'
 stats[record['status']]+=1;report.append(record)
arena_file.write_text(json.dumps(arenas,indent=2)+'\n')
result={'targeted_missing_schools':len(report),'arena_coverage':sum(bool(v.get('home_arena')) for v in arenas['teams'].values()),'status_counts':dict(stats),'details':report}
(base/'mbb-bulk-official-arena-report.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='details'},indent=2))

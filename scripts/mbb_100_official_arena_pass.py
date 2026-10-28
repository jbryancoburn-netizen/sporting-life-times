#!/usr/bin/env python3
"""100-school university-only arena research: schedule tables, venue labels, official facility links."""
import pathlib,json,re,requests,collections,concurrent.futures,urllib.parse
from bs4 import BeautifulSoup
base=pathlib.Path(__file__).resolve().parents[1]/'data'
p=base/'mbb-arena-registry.json';registry=json.loads(p.read_text())
cross=json.loads((base/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
selected=[t for t in cross if str(t.get('espn_id')) in registry['teams'] and not registry['teams'][str(t['espn_id'])].get('home_arena')][:100]
assert len(selected)==100
PAT=re.compile(r'\b(?:Arena|Center|Centre|Coliseum|Pavilion|Fieldhouse|Gymnasium|Auditorium)\b',re.I)
BAD=re.compile(r'\b(?:ticket|parking|practice|training|facility rental|seating chart|renovation|complex map|directions)\b',re.I)
def parse_place(s):
 s=re.sub(r'\s+',' ',s).strip()
 for match in (re.search(r'\(([^()]{6,75})\)',s),re.search(r'\s/\s([^/]{6,75})$',s)):
  if match and PAT.search(match.group(1)):return match.group(1).strip()
 return s if len(s)<76 and PAT.search(s) and not BAD.search(s) else ''
def check(t):
 id=str(t['espn_id']);path=base/'mbb-schedules-2026-27'/(id+'.json')
 item={'id':id,'school':t['name'],'status':'unresolved','official_pages_checked':0}
 if not path.exists():return item
 obj=json.loads(path.read_text());url=obj.get('source_url') or ''
 if not url.startswith('https://'):item['status']='missing_official_source';return item
 host=urllib.parse.urlparse(url).netloc.lower()
 if any(z in host for z in ['espn.com','realgm.com','wikipedia.org']):item['status']='disallowed_source';return item
 candidates=[url]
 if '/schedule/text/' in url:candidates.append(url.replace('/schedule/text/','/schedule/'))
 if '/schedule/' in url and '/schedule/text/' not in url:candidates.append(url.replace('/schedule/','/schedule/text/'))
 candidates=list(dict.fromkeys(candidates))
 evidence=collections.defaultdict(set);pages=[]
 for page in candidates:
  try:
   resp=requests.get(page,timeout=12,headers={'User-Agent':'Mozilla/5.0'},allow_redirects=True)
   if not resp.ok:continue
   finalhost=urllib.parse.urlparse(resp.url).netloc.lower()
   if finalhost!=host:continue
   item['official_pages_checked']+=1
   soup=BeautifulSoup(resp.text,'html.parser');pages.append(resp.url)
   for table in soup.select('table'):
    tr=table.find_all('tr')
    if not tr:continue
    headers=[x.get_text(' ',strip=True).lower() for x in tr[0].find_all(['th','td'])]
    hi=next((i for i,k in enumerate(headers) if k in ['at','site','home/away']),-1)
    vi=next((i for i,k in enumerate(headers) if k in ['location','venue']),-1)
    if hi<0 or vi<0:continue
    for row in tr[1:]:
     cols=[x.get_text(' ',strip=True) for x in row.find_all(['td','th'])]
     if len(cols)<=max(hi,vi) or cols[hi].strip().lower()!='home':continue
     arena=parse_place(cols[vi])
     if arena:evidence[arena].add(cols[vi])
   # Explicit facility inside a HOME game card is acceptable; bare facility link is NOT.
   for card in soup.select('[class*="schedule-game"],[class*="schedule_game"]'):
    text=card.get_text(' ',strip=True)
    if not re.search(r'\bHome\b|\bvs\.?\b',text,re.I):continue
    for element in card.select('[class*="location"],[class*="venue"]'):
     arena=parse_place(element.get_text(' ',strip=True))
     if arena:evidence[arena].add(text[:100])
  except Exception:continue
 counts={k:len(v) for k,v in evidence.items()}
 item['official_pages_checked']=len(pages)
 if counts:
  arena=max(counts,key=counts.get)
  if counts[arena]>=2 and counts[arena]>=sum(counts.values())*.65:
   item.update(status='official_verified',arena=arena,source=pages[0],home_games_with_venue=counts[arena])
   return item
 item['status']='official_facility_not_confirmed'
 return item
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(check,selected))
stats=collections.Counter()
for item in results:
 stats[item['status']]+=1
 if item['status']=='official_verified':
  target=registry['teams'][item['id']]
  target.update(home_arena=item['arena'],home_arena_source=item['source'],home_arena_source_type='official_2026_schedule_verified',verified_at='2026-10-28')
p.write_text(json.dumps(registry,indent=2)+'\n')
out={'schools_targeted':100,'new_verified_arenas':stats['official_verified'],'schools_total_with_home_arena':sum(bool(x.get('home_arena')) for x in registry['teams'].values()),'statuses':dict(stats),'results':results,'source_policy':'Official school athletics pages exclusively'}
(base/'mbb-100-official-arena-pass.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='results'},indent=2))

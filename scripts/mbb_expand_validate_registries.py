#!/usr/bin/env python3
"""Expand school arena registry with explicit official schedule facility evidence; validate logo image endpoints."""
import pathlib,json,re,collections,concurrent.futures,requests
root=pathlib.Path(__file__).resolve().parents[1];data=root/'data'
arenafile=data/'mbb-arena-registry.json';logofile=data/'mbb-logo-registry.json'
arenas=json.loads(arenafile.read_text());logos=json.loads(logofile.read_text())
counts=collections.Counter()
pattern=re.compile(r'\b(?:Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium)\b',re.I)
for tid,team in arenas['teams'].items():
 p=data/'mbb-schedules-2026-27'/(tid+'.json')
 if not p.exists():continue
 options=collections.defaultdict(lambda:{'count':0,'sources':set()})
 for e in json.loads(p.read_text()).get('events',[]):
  c=(e.get('competitions') or [{}])[0];v=c.get('venue') or {}
  own=next((x for x in c.get('competitors',[]) if str((x.get('team') or {}).get('id'))==tid),{})
  if own.get('homeAway')!='home' or e.get('site_verified') is not True:continue
  raw=v.get('official_school_location') or ''
  facility=v.get('arenaName') or ''
  embedded=re.search(r'\(([^()]+)\)',raw)
  if not facility and embedded and pattern.search(embedded.group(1)):facility=embedded.group(1).strip()
  if not facility or not pattern.search(facility):continue
  src=v.get('arena_source_url') or v.get('source_url') or e.get('site_source_url')
  if not src or not str(src).startswith('https://'):continue
  entry=options[facility];entry['count']+=1;entry['sources'].add(src)
 sorted_options=sorted(options.items(),key=lambda kv:-kv[1]['count'])
 if not team.get('home_arena') and sorted_options and sorted_options[0][1]['count']>=2:
  name,proof=sorted_options[0]
  team['home_arena']=name;team['home_arena_source']=sorted(proof['sources'])[0]
  counts['new_arena_candidates']+=1
 if team.get('home_arena'):counts['schools_with_home_arena']+=1
urls={tid:item.get('official_logo_url') or item.get('logo_url') for tid,item in logos['teams'].items()}
def probe(pair):
 tid,url=pair
 if not url or not url.startswith('https://'):return tid,False,'no_url'
 try:
  r=requests.get(url,timeout=12,headers={'User-Agent':'Mozilla/5.0'},stream=True)
  return tid,bool(r.ok and r.headers.get('content-type','').lower().startswith('image/')),str(r.status_code)
 except Exception as exc:return tid,False,str(exc)[:70]
with concurrent.futures.ThreadPoolExecutor(max_workers=15) as exe:
 checked=list(exe.map(probe,urls.items()))
for tid,valid,reason in checked:
 logos['teams'][tid]['logo_url_verified']=valid
 if not valid:logos['teams'][tid]['logo_validation_error']=reason
 else:logos['teams'][tid].pop('logo_validation_error',None)
 counts['logo_image_valid' if valid else 'logo_image_invalid']+=1
arenafile.write_text(json.dumps(arenas,indent=2)+'\n')
logofile.write_text(json.dumps(logos,indent=2)+'\n')
report={'schools':len(arenas['teams']),'summary':dict(counts),'limitations':'HTTP image is not proof of the correct school crest; unknown arenas are deliberately left unresolved.'}
(data/'mbb-registry-validation-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

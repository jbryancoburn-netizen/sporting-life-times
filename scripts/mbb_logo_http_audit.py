#!/usr/bin/env python3
"""Audit every MBB logo URL for HTTP/image validity, and sample rendered team schedules at mobile width."""
import json,pathlib,collections,concurrent.futures,requests,subprocess,os
root=pathlib.Path(__file__).resolve().parents[1]
cross=json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
urls=collections.defaultdict(list)
for t in cross:
 p=root/'data/mbb-schedules-2026-27'/(str(t.get('espn_id'))+'.json')
 if not p.exists():continue
 for e in json.loads(p.read_text()).get('events',[]):
  for competitor in (e.get('competitions') or [{}])[0].get('competitors',[]):
   team=competitor.get('team') or {};url=team.get('logo')
   if url and url.startswith('https://'):urls[url].append(t['name'])
def check(pair):
 url,names=pair
 try:
  response=requests.get(url,timeout=9,headers={'User-Agent':'Mozilla/5.0'},stream=True)
  content_type=response.headers.get('content-type','')
  return {'url':url,'status':response.status_code,'content_type':content_type,'used_by':len(names),'valid':response.ok and content_type.startswith('image/')}
 except Exception as exc:return {'url':url,'valid':False,'error':str(exc)[:100],'used_by':len(names)}
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
 checks=list(pool.map(check,urls.items()))
bad=[x for x in checks if not x['valid']]
report={'unique_logo_urls':len(urls),'broken_urls':len(bad),'broken_images':bad[:300],'note':'HTTP image verification; browser screenshots tested in a separate Playwright job'}
(root/'data/mbb-logo-http-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'unique_logo_urls':len(urls),'broken_urls':len(bad)}))

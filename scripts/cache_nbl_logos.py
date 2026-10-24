#!/usr/bin/env python3
"""Fetch genuine NBL team crest assets from ESPN, cache for GitHub Pages."""
import json, urllib.request, urllib.parse
from pathlib import Path
TEAMS=['Adelaide 36ers','Brisbane Bullets','Cairns Taipans','Illawarra Hawks','Melbourne United','New Zealand Breakers','Perth Wildcats','South East Melbourne Phoenix','Sydney Kings','Tasmania JackJumpers']
def norm(s):return ''.join(c for c in str(s).lower() if c.isalnum())
def request(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'*/*'}),timeout=30)
with request('https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/teams?limit=100') as r: data=json.load(r)
matched={}
for item in data.get('sports',[{}])[0].get('leagues',[{}])[0].get('teams',[]):
 t=item.get('team',item)
 img=next((x.get('href') for x in t.get('logos',[]) if x.get('href')),None) or t.get('logo')
 if img:
  for key in ('displayName','name','shortDisplayName'):
   if t.get(key):matched[norm(t[key])]=img
out=Path('assets/nbl-logos');out.mkdir(parents=True,exist_ok=True)
manifest={}
for team in TEAMS:
 u=matched.get(norm(team))
 if not u:
  print('UNMATCHED',team);continue
 host=urllib.parse.urlparse(u).hostname or ''
 if not (host=='espn.com' or host.endswith('.espn.com') or host=='espncdn.com' or host.endswith('.espncdn.com')):continue
 try:
  with request(u) as r: raw=r.read(300000)
  ext='.png' if raw.startswith(bytes.fromhex('89504e470d0a1a0a')) else '.webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else '.svg' if b'<svg' in raw[:1000] else None
  if not ext:raise ValueError('Unrecognized image')
  filename=norm(team)+ext;(out/filename).write_bytes(raw)
  manifest[team]='assets/nbl-logos/'+filename
  print('CACHED',team,filename)
 except Exception as exc: print('FETCH FAILED',team,str(exc))
(out/'manifest.json').write_text(json.dumps({'source':'ESPN NBL team directory','teams':manifest,'missing':[x for x in TEAMS if x not in manifest]},indent=2)+'\n')
print('Cached',len(manifest),'of 10')
if len(manifest)!=10:raise SystemExit('Not all team crest assets available; manifest remains diagnostic only')

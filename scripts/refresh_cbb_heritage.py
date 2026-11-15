#!/usr/bin/env python3
"""Refresh the existing 11 self-hosted Big East logos, ensuring files and shared renderer stay in sync."""
from pathlib import Path
from PIL import Image
import json,re
ROOT=Path(__file__).resolve().parents[1]
JS=ROOT/'mbb-logo-system.js'
VERSION='20261114-bigeast-a10-refresh2'
src=JS.read_text()
matches=re.search(r'const BIG_EAST_HERITAGE=Object\.freeze\(\{([\s\S]*?)\}\);',src)
if not matches:raise SystemExit('Big East renderer mapping not found')
records=re.findall(r"'(\d+)':'(assets/cbb-big-east-1980s/[^']+)'",matches.group(1))
if len(records)!=11 or len(set(k for k,v in records))!=11:raise SystemExit('Must have 11 unique Big East logos')
for school_id,url in records:
 p=ROOT/url.split('?')[0]
 if not p.is_file():raise SystemExit('Missing historical artwork '+str(p))
 with Image.open(p) as im:
  if im.format!='PNG' or im.width<150 or im.height<150:raise SystemExit('Invalid image '+str(p))
  if im.getbbox() is None:raise SystemExit('Blank image '+str(p))
  im.verify()
newblock=matches.group(1)
for _,url in records:
 path=url.split('?')[0]
 newblock=newblock.replace(url,path+'?v='+VERSION)
src=src[:matches.start(1)]+newblock+src[matches.end(1):]
JS.write_text(src)
updated=[]
for p in ROOT.glob('*.html'):
 s=p.read_text()
 t=re.sub(r'mbb-logo-system\.js\?v=[^"\'<>\s]+','mbb-logo-system.js?v='+VERSION,s)
 if t!=s:p.write_text(t);updated.append(p.name)
report={'conference':'Big East','season':'2026-27','files_verified':len(records),'logo_ids':[k for k,v in records],
 'status':'11_local_images_validated_and_renderer_cache_busted',
 'rendering':'Shared NCAA basketball renderer for men and women',
 'public_visual_verification':False,
 'cache_version':VERSION,
 'html_pages_refreshed':len(updated)}
out=ROOT/'data/cbb-big-east-heritage-release.json'
out.write_text(json.dumps(report,indent=2)+'\n')
print('Big East assets verified:',len(records),'root HTML pages refreshed:',len(updated))

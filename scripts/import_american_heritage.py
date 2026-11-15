#!/usr/bin/env python3
"""Import original-era American Conference logos as *local* files.

Exact season intervals and sport-specific constraints are validated. A missing or
ambiguous image keeps the modern logo; it cannot silently publish a different era.
The importer is incremental and preserves previously validated local marks.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from io import BytesIO
from collections import Counter
import re,json,requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'data/cbb-american-heritage-audit.json'
RENDERER=ROOT/'mbb-logo-system.js'
BASE='https://sportslogohistory.com/'
SLUG={
'2429':'charlotte-49ers',
'151':'east-carolina-pirates',
'2226':'florida-atlantic-owls',
'235':'memphis-tigers',
'249':'north-texas-mean-green',
'242':'rice-owls',
'58':'south-florida-bulls',
'218':'temple-owls',
'2655':'tulane-green-wave',
'202':'tulsa-golden-hurricane',
'5':'uab-blazers',
'2636':'utsa-roadrunners',
'2724':'wichita-state-shockers'
}
S=requests.Session()
S.headers.update({'User-Agent':'Mozilla/5.0 (Sporting Life and Times logo historical catalog)'})
def source_image(team):
 eid=team['espn_id']
 era=team['historical_choice']['era']
 start,end=[int(x) for x in re.findall(r'\d{4}',era)]
 kind=team['historical_choice']['logo_type'].lower()
 slug=SLUG[eid]
 pages=[BASE+slug+'-'+kind+'-logo/']
 if kind!='primary':pages.append(BASE+slug+'-primary-logo/')
 errors=[]
 for page in pages:
  try:
   response=S.get(page,timeout=28);response.raise_for_status()
   soup=BeautifulSoup(response.text,'html.parser')
   candidates={}
   for img in soup.select('img[src],img[data-src],img[data-lazy-src]'):
    for attr in ('data-src','data-lazy-src','src'):
     raw=img.get(attr)
     if not raw:continue
     url=urljoin(page,raw)
     if urlparse(url).hostname not in ('sportslogohistory.com','www.sportslogohistory.com'):continue
     fn=url.split('?')[0].split('/')[-1].lower()
     if '/wp-content/uploads/' not in url or not re.search(r'\.(png|webp|jpe?g)$',fn):continue
     # Require BOTH bounds, not a neighboring era that merely shares a year.
     if not re.search(r'(?<!\d)'+str(start)+r'[-_ ]+'+str(end)+r'(?!\d)',fn):continue
     if eid=='2655' and any(x in fn for x in ('football','gridiron')):continue
     # Mascot on Tulane original primary (pennant). Never use football-specific alternate.
     candidates[url]=True
   found=list(candidates)
   if len(found)==1:return found[0],page
   errors.append(f'{page}: {len(found)} exact era images')
  except Exception as e:errors.append(str(e)[:130])
 raise RuntimeError('; '.join(errors))
def download(url):
 r=S.get(url,timeout=35);r.raise_for_status()
 if not 1200<len(r.content)<12_000_000:raise ValueError('Source image byte count invalid')
 im=Image.open(BytesIO(r.content)).convert('RGBA')
 if min(im.size)<170:raise ValueError('Source image low resolution')
 if im.getchannel('A').getextrema()==(255,255):
  px=im.load()
  for y in range(im.height):
   for x in range(im.width):
    red,green,blue,a=px[x,y]
    if min(red,green,blue)>249:px[x,y]=(red,green,blue,0)
 box=im.getbbox()
 if box is None:raise ValueError('Blank artwork')
 im=im.crop(box)
 im.thumbnail((610,610),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(720,720))
 canvas.alpha_composite(im,((720-im.width)//2,(720-im.height)//2))
 data=BytesIO();canvas.save(data,'PNG',optimize=True)
 return data.getvalue()
def main():
 doc=json.loads(MANIFEST.read_text())
 js=RENDERER.read_text()
 anchor='const retroURLForESPN=id=>'
 if anchor not in js:raise RuntimeError('Missing shared renderer contract')
 existing=re.search(r'const AMERICAN_HERITAGE=Object\.freeze\(\{([\s\S]*?)\}\);',js)
 old={}
 if existing:
  for eid,url in re.findall(r"'(\d+)':'([^']+)'",existing.group(1)):
   if (ROOT/url.split('?')[0]).is_file():old[eid]=url
 new={};failed={}
 for t in doc['teams']:
  eid=t['espn_id']
  if eid in old:continue
  try:
   url,source=source_image(t)
   blob=download(url)
   new[eid]=(t,blob,url,source)
  except Exception as e:failed[eid]=str(e)
 if not new and not old:raise RuntimeError('No authenticated American artwork, abort without website changes')
 entries=dict(old)
 for eid,(t,blob,url,source) in new.items():
  path=ROOT/t['logo_path']
  path.parent.mkdir(parents=True,exist_ok=True)
  path.write_bytes(blob)
  with Image.open(path) as im:im.verify()
  entries[eid]=t['logo_path']+'?v=american-vintage-20261114-1'
  t.update(retro_image_published=True,local_asset_status='verified_local_png',archival_image_url=url,archive_logo_page=source)
  t.pop('error',None)
 for t in doc['teams']:
  if t['espn_id'] in failed:
   t.update(retro_image_published=False,local_asset_status='modern_fallback',error=failed[t['espn_id']][:270])
 block='const AMERICAN_HERITAGE=Object.freeze({\n'+',\n'.join(f" '{eid}':'{url}'" for eid,url in entries.items())+'\n});'
 if existing:js=js[:existing.start()]+block+js[existing.end():]
 else:js=js.replace(anchor,block+'\n'+anchor,1)
 lookup=re.search(r'(const retroURLForESPN=id=>)([^;]+);',js)
 if lookup is None:raise RuntimeError('Cannot locate shared lookup')
 if 'AMERICAN_HERITAGE[String(id)]' not in lookup.group(2):
  js=js[:lookup.start()]+lookup.group(1)+lookup.group(2).replace("||''","||AMERICAN_HERITAGE[String(id)]||''")+';'+js[lookup.end():]
 RENDERER.write_text(js)
 doc['status']='historical_artwork_partially_published_with_fallback'
 doc['imported_count']=len(entries)
 doc['unresolved_count']=13-len(entries)
 MANIFEST.write_text(json.dumps(doc,indent=2)+'\n')
 for page in ROOT.glob('*.html'):
  text=page.read_text()
  updated=re.sub(r'mbb-logo-system\.js\?v=[^"\'<>\s]+','mbb-logo-system.js?v=american-vintage-20261114-1',text)
  if updated!=text:page.write_text(updated)
 print('Imported',len(new),'new logos, total',len(entries),'/13. Unresolved:',failed)
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Import verified historical Mountain West basketball logos.

Use exact date-bounded historical primary archive images and preserve all existing
shared logo mappings. Failed or ambiguous logos keep verified modern fallbacks.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from io import BytesIO
import json,re,requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
AUDIT=ROOT/'data/cbb-mountain-west-heritage-audit.json'
JS=ROOT/'mbb-logo-system.js'
# Individually inspected archival artwork; each source and era is documented in
# the Mountain West audit. Direct image links avoid fragile HTML scraping.
PINNED={
 '167':'https://sportslogohistory.com/wp-content/uploads/2021/09/new_mexico_lobos_1973-1999.png',
 '2005':'https://upload.wikimedia.org/wikipedia/commons/d/da/Air_Force_Falcons_logo_1963-1994.png',
 '2253':'https://content.sportslogos.net/logos/31/5050/full/grand_canyon_antelopes_logo_secondary_1978_sportslogosnet-3306.png',
 '2440':'https://content.sportslogos.net/logos/33/767/full/nevada_wolf_pack_logo_primary_1979_sportslogosnet-6993.png',
 '23':'https://upload.wikimedia.org/wikipedia/commons/b/be/SJSU_Main_Logo_from_1983_to_1999.png',
 '62':'https://content.sportslogos.net/logos/31/696/full/hawaii_warriors_logo_primary_19823834.png',
 '2751':'https://content.sportslogos.net/logos/35/918/full/wyoming_cowboys_logo_primary_19869705.png',
 '2439':'https://content.sportslogos.net/logos/35/888/full/unlv_rebels_logo_primary_19833350.png',
 '302':'https://content.sportslogos.net/logos/30/1831/full/california_davis_aggies_logo_primary_19599786.png',
 '2638':'https://content.sportslogos.net/logos/35/889/full/utep-miners-alternate-logo-1980-88977171980.png'
}
PINNED_ERA={
 '167':(1973,1999),'2005':(1963,1994),'2253':(1978,2013),
 '2440':(1979,1993),'23':(1983,1999),'2638':(1980,1999),
 '62':(1980,2000),'2751':(1986,2007),'2439':(1983,1997),'302':(1959,1999)
}
S=requests.Session()
S.headers.update({'User-Agent':'Mozilla/5.0 (Sporting Life Times historic basketball logo archive)'})
def find_art(team):
 choice=team['historical_choice']
 start,end=choice['start_year'],choice['end_year']
 if start is None or end is None:
  raise ValueError('Historical artwork date is not independently authenticated')
 page=choice['history_url']
 if team['espn_id'] in PINNED:
  url=PINNED[team['espn_id']]
  filename=url.split('/')[-1]
  if PINNED_ERA[team['espn_id']]!=(start,end):raise RuntimeError('Pinned image historical era differs from documented choice')
  return url,page
 response=S.get(page,timeout=30);response.raise_for_status()
 soup=BeautifulSoup(response.text,'html.parser')
 found={}
 for img in soup.select('img[src],img[data-src],img[data-lazy-src]'):
  for attr in ('data-src','data-lazy-src','src'):
   raw=img.get(attr)
   if not raw:continue
   url=urljoin(page,raw);host=urlparse(url).hostname or ''
   if host not in ('sportslogohistory.com','www.sportslogohistory.com'):continue
   filename=url.split('?',1)[0].split('/')[-1].lower()
   if '/wp-content/uploads/' not in url or not re.search(r'\.(?:png|jpe?g|webp)$',filename):continue
   # Date-bounded historical mark: prevent mistaken modern logos and adjacent eras.
   if not re.search(r'(?<!\d)'+str(start)+r'[-_ ]+'+str(end)+r'(?!\d)',filename):continue
   found[url]=1
 candidates=list(found)
 if len(candidates)!=1:raise ValueError(f'Historical {start}–{end} primary mark is not unique: {candidates[:5]}')
 return candidates[0],page
def local_png(url):
 r=S.get(url,timeout=30);r.raise_for_status()
 if not 1400<len(r.content)<12000000:raise ValueError('Invalid image size')
 im=Image.open(BytesIO(r.content)).convert('RGBA')
 if min(im.size)<160:raise ValueError('Source artwork below minimum resolution')
 if im.getchannel('A').getextrema()==(255,255):
  px=im.load()
  for y in range(im.height):
   for x in range(im.width):
    red,green,blue,a=px[x,y]
    if min(red,green,blue)>249:px[x,y]=(red,green,blue,0)
 bb=im.getbbox()
 if not bb:raise ValueError('Blank historical artwork')
 im=im.crop(bb)
 im.thumbnail((610,610),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(720,720))
 canvas.alpha_composite(im,((720-im.width)//2,(720-im.height)//2))
 buf=BytesIO();canvas.save(buf,'PNG',optimize=True)
 return buf.getvalue()
def main():
 audit=json.loads(AUDIT.read_text())
 if len(audit['teams'])!=10:raise RuntimeError('Expected exactly ten 2026-27 Mountain West schools')
 js=JS.read_text()
 marker='const retroURLForESPN=id=>'
 if marker not in js:raise RuntimeError('Shared NCAA logo lookup changed')
 block_pattern=r'const MOUNTAIN_WEST_HERITAGE=Object\.freeze\(\{([\s\S]*?)\}\);'
 previous=re.search(block_pattern,js)
 existing={}
 if previous:
  for eid,url in re.findall(r"'(\d+)':'([^']+)'",previous.group(1)):
   if (ROOT/url.split('?',1)[0]).is_file():existing[eid]=url
 additions={};errors={}
 for team in audit['teams']:
  eid=team['espn_id']
  if eid in existing and eid!='2638':continue
  try:
   image_url,source=find_art(team)
   data=local_png(image_url)
   additions[eid]=(team,data,image_url,source)
  except Exception as exc:errors[eid]=str(exc)
 if not existing and not additions:
  raise RuntimeError('No verified historical images available: '+repr(errors))
 entries=dict(existing)
 for eid,(team,data,image_url,source) in additions.items():
  output=ROOT/team['target_path']
  output.parent.mkdir(parents=True,exist_ok=True)
  output.write_bytes(data)
  with Image.open(output) as image:image.verify()
  entries[eid]=team['target_path']+'?v=mountain-west-heritage-20261114-1'
  team.update(retro_asset_status='verified_self_hosted_png',historical_asset_published=True,archival_image_url=image_url,archive_source_url=source)
  team.pop('import_error',None)
 for team in audit['teams']:
  if team['espn_id'] in errors:
   team.update(retro_asset_status='modern_fallback_historical_original_pending',historical_asset_published=False,import_error=errors[team['espn_id']][:300])
 block='const MOUNTAIN_WEST_HERITAGE=Object.freeze({\n'+',\n'.join(f" '{id}':'{url}'" for id,url in entries.items())+'\n});'
 if previous:js=js[:previous.start()]+block+js[previous.end():]
 else:js=js.replace(marker,block+'\n'+marker,1)
 lookup=re.search(r'(const retroURLForESPN=id=>)([^;]+);',js)
 if not lookup:raise RuntimeError('Shared retro resolver missing')
 if 'MOUNTAIN_WEST_HERITAGE[String(id)]' not in lookup.group(2):
  changed=lookup.group(2).replace("||''","||MOUNTAIN_WEST_HERITAGE[String(id)]||''")
  if changed==lookup.group(2):raise RuntimeError('Retro resolver cannot be extended safely')
  js=js[:lookup.start()]+lookup.group(1)+changed+';'+js[lookup.end():]
 if 'heritageMountainWestTeamIds:' not in js:
  anchor='heritageBigEastTeamIds:()=>Object.keys(BIG_EAST_HERITAGE),'
  if anchor not in js:raise RuntimeError('Logo renderer public API changed')
  js=js.replace(anchor,anchor+'heritageMountainWestTeamIds:()=>Object.keys(MOUNTAIN_WEST_HERITAGE),',1)
 JS.write_text(js)
 audit.update(status='partially_imported_with_verified_modern_fallbacks',imported_count=len(entries),missing_count=10-len(entries))
 AUDIT.write_text(json.dumps(audit,indent=2)+'\n')
 for html in ROOT.glob('*.html'):
  src=html.read_text()
  out=re.sub(r'mbb-logo-system\.js\?v=[^"\'<>\s]+','mbb-logo-system.js?v=mountain-west-heritage-20261114-1',src)
  if out!=src:html.write_text(out)
 print(f'Mountain West: {len(entries)}/10 verified local vintage logos.')
 for eid,err in errors.items():print('UNRESOLVED',eid,err[:170])
if __name__=='__main__':main()

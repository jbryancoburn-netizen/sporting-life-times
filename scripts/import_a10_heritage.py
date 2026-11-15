#!/usr/bin/env python3
"""Import genuine A10 archive images to local files; publish only independently validated marks.
Never write unresolved logos into the shared renderer. Modern artwork remains the fallback.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from io import BytesIO
import json,re,requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'data/cbb-atlantic-10-heritage-audit.json'
RENDERER=ROOT/'mbb-logo-system.js'
OUT=ROOT/'assets/cbb-atlantic-10-1980s'
# Historic archive page for each *specific* choice. Generic history pages use date-checked selection.
DIRECT={
'2166':'https://www.sportslogos.net/logos/view/65488721985/Davidson-Wildcats-Logo/1989/Primary-Logo',
'2168':'https://www.sportslogos.net/logos/view/65584961984/Dayton-Flyers-Logo/1984/Primary-Logo',
'2184':'https://www.sportslogos.net/logos/view/66468231975/Duquesne-Dukes-Logo/1975/Primary-Logo',
'2230':'https://www.sportslogos.net/logos/view/ell5t8vkmqi8hewrdykg/Fordham-Rams-Logo/1994/Primary-Logo',
'2244':'https://www.sportslogos.net/logos/view/68462861980/George-Mason-Patriots-Logo/1980/Primary-Logo',
'45':'https://www.sportslogos.net/logos/view/68522521967/George-Washington-Colonials-Logo/1967/Primary-Logo',
'2325':'https://www.sportslogos.net/logos/view/72441311973/La-Salle-Explorers-Logo/1973/Primary-Logo',
'227':'https://www.sportslogos.net/logos/view/4708/Rhode-Island-Rams-Logo/1989/Primary-Logo',
'2603':'https://www.sportslogos.net/logos/view/85187521982/Saint-Josephs-Hawks-Logo/1982/Primary-Logo',
'139':'https://www.sportslogos.net/logos/view/82242201985/Saint-Louis-Billikens-Logo/1984/Primary-Logo',
'2670':'https://www.sportslogos.net/logos/view/89914681968/VCU-Rams-Logo/1968/Primary-Logo'}
# Exact archive image recovered from the vetted George Washington 1967-83 logo page.
# Avoid depending solely on SportsLogos HTML selectors changing over time.
DIRECT_IMAGE={
 '45':'https://content.sportslogos.net/logos/31/685/full/george_washington_colonials_logo_primary_1967_sportslogosnet-2252.png'
}
S=requests.Session()
S.headers.update({'User-Agent':'Mozilla/5.0 (compatible; SportingLifeAndTimes/1.0; A10 logo archival import)'})
def archival_image(url, direct_image=None):
 r=S.get(url,timeout=25);r.raise_for_status()
 soup=BeautifulSoup(r.text,'html.parser')
 # Select image from the designated logo page, not banners, ads, thumbnails, merchandise.
 imgs=[]
 for tag in soup.select('a[href],img[src],img[data-src],meta[property="og:image"]'):
  raw=tag.get('href') or tag.get('data-src') or tag.get('src') or tag.get('content') or ''
  target=urljoin(url,raw)
  if urlparse(target).hostname=='content.sportslogos.net' and '/full/' in target and re.search(r'\.(png|webp|jpg|jpeg)(?:\?|$)',target,re.I):
   imgs.append(target)
 if direct_image:imgs.insert(0,direct_image)
 imgs=list(dict.fromkeys(imgs))
 if not imgs:raise RuntimeError('No full historical logo at '+url)
 errors=[]
 for target in imgs:
  try:
   imgresp=S.get(target,timeout=25);imgresp.raise_for_status()
   if not 1500<len(imgresp.content)<12_000_000:raise ValueError('Invalid logo byte size')
   img=Image.open(BytesIO(imgresp.content)).convert('RGBA')
   if min(img.size)<170:raise ValueError('Historical image is too small')
   # The archival service sometimes supplies a flat white background.
   if img.getchannel('A').getextrema()==(255,255):
    from PIL import ImageChops
    rgba=img.copy()
    data=rgba.load()
    for y in range(rgba.height):
     for x in range(rgba.width):
      red,green,blue,alpha=data[x,y]
      if min(red,green,blue)>249:
       data[x,y]=(red,green,blue,0)
    img=rgba
   bound=img.getbbox()
   if not bound:raise ValueError('Historical image is empty')
   img=img.crop(bound)
   img.thumbnail((610,610),Image.Resampling.LANCZOS)
   out=Image.new('RGBA',(720,720))
   out.alpha_composite(img,((720-img.width)//2,(720-img.height)//2))
   buffer=BytesIO();out.save(buffer,format='PNG',optimize=True)
   return buffer.getvalue(),target
  except Exception as e:errors.append(str(e))
 raise RuntimeError('Archive logo cannot be verified: '+'; '.join(errors[:3]))
def main():
 doc=json.loads(MANIFEST.read_text())
 js=RENDERER.read_text()
 marker='const retroURLForESPN=id=>'
 if marker not in js:raise RuntimeError('Logo renderer contract changed')
 if 'const A10_HERITAGE=' in js:
  print('A10 heritage mapping already installed; no rewrite')
  return
 downloaded={};issues={}
 for team in doc['teams']:
  eid=team['espn_id']
  page=DIRECT.get(eid)
  # Do not guess an exact artwork from a timeline, especially Richmond and St. Bonaventure.
  # Loyola Wolf is also withheld until a confirmed archive image of the 1990-94 design exists.
  if not page:
   issues[eid]='Specific archival primary-logo image is not yet authenticated'
   continue
  try:
   data,image_url=archival_image(page,DIRECT_IMAGE.get(eid))
   downloaded[eid]=(team,data,image_url,page)
  except Exception as e:
   issues[eid]=str(e)
 if not downloaded:raise RuntimeError('No archival images passed import validation')
 OUT.mkdir(parents=True,exist_ok=True)
 mapping=[]
 for eid,(team,data,image_url,page) in downloaded.items():
  filename=Path(team['target_path']).name
  path=OUT/filename
  path.write_bytes(data)
  with Image.open(path) as img:img.verify()
  mapping.append(" '%s':'%s?v=a10-archive-20261114-1'"%(eid,team['target_path']))
  team['retro_asset_status']='local_image_verified'
  team['archival_image_url']=image_url
  team['historical_research_url']=page
 for team in doc['teams']:
  if team['espn_id'] in issues:
   team['retro_asset_status']='archival_artwork_unverified_modern_fallback'
   team['asset_import_error']=issues[team['espn_id']][:280]
 # Map only validated paths. Never insert a missing asset into a live page.
 block='const A10_HERITAGE=Object.freeze({\n'+',\n'.join(mapping)+'\n});\n'
 js=js.replace(marker,block+marker,1)
 old="||BIG_EAST_HERITAGE[String(id)]||''"
 if old not in js:raise RuntimeError('Unexpected renderer fallback chain')
 js=js.replace(old,"||BIG_EAST_HERITAGE[String(id)]||A10_HERITAGE[String(id)]||''",1)
 oldapi='heritageBigEastTeamIds:()=>Object.keys(BIG_EAST_HERITAGE),'
 if oldapi in js:
  js=js.replace(oldapi,oldapi+'heritageA10TeamIds:()=>Object.keys(A10_HERITAGE),',1)
 elif 'heritageA10TeamIds:' not in js:
  raise RuntimeError('Logo API contract changed')
 RENDERER.write_text(js)
 doc['release_status']='partial_historical_assets_imported_unverified_entries_use_modern'
 doc['imported_count']=len(downloaded)
 doc['missing_count']=len(issues)
 doc['modern_fallback_maintained']=True
 MANIFEST.write_text(json.dumps(doc,indent=2)+'\n')
 # Cache bust only after assets and renderer successfully validated.
 for html in ROOT.glob('*.html'):
  text=html.read_text()
  latest=re.sub(r'mbb-logo-system\.js\?v=[^"\'<>\s]+','mbb-logo-system.js?v=a10-heritage-20261114-1',text)
  if latest!=text:html.write_text(latest)
 print('Imported',len(downloaded),'historic A10 logos; unresolved',len(issues))
 for eid,error in issues.items():print('  unresolved',eid,error[:100])
if __name__=='__main__':main()

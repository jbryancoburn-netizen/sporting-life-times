#!/usr/bin/env python3
"""Fail-closed, one-time Big 12 historical basketball logo publication."""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from io import BytesIO
import re,json,requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
LOGOS={
'12':('arizona','60327501981/Arizona-Wildcats-Logo/1981/Secondary-Logo'),
'9':('arizona-state','02rkd23qe4x6wu3ho6j5hjw9b/Arizona-State-Sun-Devils-Logo/1967/Primary-Logo'),
'66':('iowa-state','71372571983/Iowa-State-Cyclones-Logo/1974/Primary-Logo'),
'2305':('kansas','2509/Kansas-Jayhawks-Logo/1946/Primary-Logo'),
'2306':('kansas-state','71921871972/Kansas-State-Wildcats-Logo/1972/Primary-Logo'),
'239':('baylor','7368/Baylor-Bears-Logo/1948/Primary-Logo'),
'248':('houston','gzwei4qgopygfwgzzk0f/Houston-Cougars-Logo/1962/Primary-Logo'),
'2628':('tcu','86821741965/TCU-Horned-Frogs-Logo/1965/Primary-Logo'),
'197':('oklahoma-state','79465681973/Oklahoma-State-Cowboys-Logo/1973/Mascot-Logo'),
'2641':('texas-tech','vwkp1fp6p9fhukjzkx3m/Texas-Tech-Red-Raiders-Logo/2017/Mascot-Logo'),
'252':('byu','5834/Brigham-Young-Cougars-Logo/1982/Primary-Logo'),
'2132':('cincinnati','7483/Cincinnati-Bearcats-Logo/1983/Secondary-Logo'),
'38':('colorado','7490/Colorado-Buffaloes-Logo/1981/Primary-Logo'),
'2116':('ucf','63532611979/UCF-Knights-Logo/1979/Primary-Logo'),
'254':('utah','89254541969/Utah-Utes-Logo/1975/Primary-Logo'),
'277':('west-virginia','90726501980/West-Virginia-Mountaineers-Logo/1980/Primary-Logo')}
S=requests.Session();S.headers['User-Agent']='Mozilla/5.0 (Sporting Life and Times image import)'
def fetch(slug,path):
 page='https://www.sportslogos.net/logos/view/'+path
 r=S.get(page,timeout=25);r.raise_for_status()
 soup=BeautifulSoup(r.text,'html.parser')
 urls=[]
 for element in soup.find_all(['a','img']):
  for attr in ('href','src','data-src'):
   raw=element.get(attr)
   if not raw: continue
   u=urljoin(page,raw)
   if urlparse(u).hostname=='content.sportslogos.net' and re.search(r'\.(png|webp|jpg|jpeg)(\?|$)',u,re.I):urls.append(u)
 if not urls: raise RuntimeError(slug+': historical image link missing')
 urls.sort(key=lambda x:('full/' not in x,len(x)))
 r=S.get(urls[0],timeout=35);r.raise_for_status()
 if len(r.content)<1000 or len(r.content)>12000000:raise RuntimeError(slug+': suspicious file size')
 im=Image.open(BytesIO(r.content)).convert('RGBA')
 if min(im.size)<180:raise RuntimeError(slug+': low resolution')
 bounds=im.getbbox()
 if not bounds:raise RuntimeError(slug+': blank artwork')
 im=im.crop(bounds)
 # Preserve all original artwork; 720-square transparent canvas for ring-safe sizing.
 im.thumbnail((620,620),Image.Resampling.LANCZOS)
 result=Image.new('RGBA',(720,720),(0,0,0,0))
 result.alpha_composite(im,((720-im.width)//2,(720-im.height)//2))
 buf=BytesIO();result.save(buf,format='PNG',optimize=True)
 return buf.getvalue(),urls[0],page
def main():
 js=ROOT/'mbb-logo-system.js';old=js.read_text()
 if 'const BIG_12_HERITAGE=' in old: return
 if "||BIG_EAST_HERITAGE[String(id)]||''" not in old:raise RuntimeError('renderer changed')
 # All sixteen must succeed before any production file is modified.
 assets={ident:fetch(*item) for ident,item in LOGOS.items()}
 out=ROOT/'assets/cbb-big-12-1980s';out.mkdir(parents=True,exist_ok=True)
 for ident,(slug,_) in LOGOS.items(): (out/(slug+'.png')).write_bytes(assets[ident][0])
 lines=',\n'.join(" '%s':'assets/cbb-big-12-1980s/%s.png?v=20261114-big12-16-live1'"%(ident,slug) for ident,(slug,_) in LOGOS.items())
 new=old.replace('const retroURLForESPN=id=>','const BIG_12_HERITAGE=Object.freeze({\n'+lines+'\n});\nconst retroURLForESPN=id=>',1)
 new=new.replace("||BIG_EAST_HERITAGE[String(id)]||''","||BIG_EAST_HERITAGE[String(id)]||BIG_12_HERITAGE[String(id)]||''",1)
 new=new.replace('heritageBigEastTeamIds:()=>Object.keys(BIG_EAST_HERITAGE),','heritageBigEastTeamIds:()=>Object.keys(BIG_EAST_HERITAGE),heritageBig12TeamIds:()=>Object.keys(BIG_12_HERITAGE),',1)
 if new.count('BIG_12_HERITAGE')!=3:raise RuntimeError('renderer integration failed')
 js.write_text(new)
 manifest=ROOT/'data/cbb-big-12-heritage-audit.json'
 data=json.loads(manifest.read_text());data['release_status']='all_16_heritage_logos_imported'
 for row in data['teams']:
  if row['espn_id'] not in LOGOS:continue
  slug,_=LOGOS[row['espn_id']]
  row.update(target_path='assets/cbb-big-12-1980s/'+slug+'.png',status='local_asset_verified',source_research=assets[row['espn_id']][2],downloaded_from=assets[row['espn_id']][1],approved=True)
 manifest.write_text(json.dumps(data,indent=2)+'\n')
 count=0
 for p in ROOT.glob('*.html'):
  txt=p.read_text()
  if 'mbb-logo-system.js?v=' not in txt:continue
  updated=re.sub(r'mbb-logo-system\.js\?v=[^"\'<>\s]+','mbb-logo-system.js?v=cbb-big12-16-20261114b',txt)
  if updated!=txt:p.write_text(updated);count+=1
 print('Prepared 16 local vintage logos and cache-busted',count,'pages')
if __name__=='__main__':main()

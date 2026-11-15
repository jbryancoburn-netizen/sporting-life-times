#!/usr/bin/env python3
"""Install verified historical American Conference artwork into the shared NCAA logo renderer.

A historical era must match the manifest exactly. If the source page or image fails
validation, keep the current modern asset instead. No external runtime dependencies.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from io import BytesIO
import json,re,requests
from bs4 import BeautifulSoup
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'data/cbb-american-heritage-audit.json'
RENDERER=ROOT/'mbb-logo-system.js'
SESSION=requests.Session()
SESSION.headers['User-Agent']='Mozilla/5.0 (Sporting Life & Times historic logo importer)'
def fetch_page(url):
 r=SESSION.get(url,timeout=24)
 r.raise_for_status()
 return BeautifulSoup(r.text,'html.parser')
def exact_logo_page(history,era,kind):
 soup=fetch_page(history)
 start,end=[int(v) for v in re.findall(r'\d{4}',era)]
 candidate=[]
 for anchor in soup.select('a[href]'):
  link=urljoin(history,anchor['href'])
  if '/logos/view/' not in link or not link.startswith('https://www.sportslogos.net/'):continue
  name=anchor.get_text(' ',strip=True).lower()
  text=(anchor.get('title') or '')+' '+name
  # SportsLogos archives label the timeline 1979 - 2000; the URL contains the initial year.
  if str(start) not in link and str(start) not in text:continue
  if kind.lower() not in link.lower() and kind.lower() not in text.lower():continue
  candidate.append(link)
 candidate=list(dict.fromkeys(candidate))
 if len(candidate)!=1:
  raise ValueError(f'Could not uniquely identify exact {era} {kind} image: {candidate[:5]}')
 return candidate[0]
def logo_image(page):
 soup=fetch_page(page)
 # Pick the principal logo image, not any other thumbnails, ads or merchandise.
 images=[]
 for img in soup.select('img[src],img[data-src]'):
  alt=(img.get('alt') or '').lower()
  u=urljoin(page,img.get('data-src') or img.get('src') or '')
  if urlparse(u).hostname=='content.sportslogos.net' and '/full/' in u and re.search(r'\.(png|webp|jpe?g)(\?|$)',u,re.I):
   images.append((u,alt))
 unique=list(dict.fromkeys(u for u,alt in images if 'logo' in alt))
 if len(unique)!=1:raise ValueError(f'Expected one main historical logo; got {len(unique)} in {page}')
 r=SESSION.get(unique[0],timeout=30);r.raise_for_status()
 if not 1500<len(r.content)<12_000_000:raise ValueError('Invalid historical image byte length')
 image=Image.open(BytesIO(r.content)).convert('RGBA')
 if min(image.size)<170:raise ValueError('Historical image too small')
 bounds=image.getbbox()
 if not bounds:raise ValueError('Historical image empty')
 image=image.crop(bounds)
 image.thumbnail((604,604),Image.Resampling.LANCZOS)
 output=Image.new('RGBA',(720,720))
 output.alpha_composite(image,((720-image.width)//2,(720-image.height)//2))
 b=BytesIO();output.save(b,'PNG',optimize=True)
 return b.getvalue(),unique[0]
def main():
 doc=json.loads(MANIFEST.read_text())
 js=RENDERER.read_text()
 if 'const AMERICAN_HERITAGE=' in js:
  print('American heritage already wired. No rewrite.');return
 if 'const retroURLForESPN=id=>' not in js:raise RuntimeError('Logo renderer missing expected anchor')
 out=ROOT/'assets/cbb-american-1980s'
 files={}
 errors={}
 for team in doc['teams']:
  try:
   choice=team['historical_choice']
   page=exact_logo_page(choice['history_url'],choice['era'],choice['logo_type'])
   payload,asset=logo_image(page)
   files[team['espn_id']]=(team,payload,page,asset)
  except Exception as e:errors[team['espn_id']]=str(e)
 if not files:raise RuntimeError('No archival assets passed strict validation; no site changes')
 out.mkdir(parents=True,exist_ok=True)
 lines=[]
 for ident,(team,payload,page,asset) in files.items():
  path=ROOT/team['logo_path']
  path.parent.mkdir(parents=True,exist_ok=True)
  path.write_bytes(payload)
  with Image.open(path) as v:v.verify()
  team.update(retro_image_published=True,archive_logo_page=page,archival_image_url=asset,local_asset_status='verified_png')
  lines.append(" '%s':'%s?v=american-historic-1'"%(ident,team['logo_path']))
 for team in doc['teams']:
  if team['espn_id'] in errors:
   team.update(retro_image_published=False,local_asset_status='modern_fallback',error=errors[team['espn_id']][:300])
 block='const AMERICAN_HERITAGE=Object.freeze({\n'+',\n'.join(lines)+'\n});\n'
 js=js.replace('const retroURLForESPN=id=>',block+'const retroURLForESPN=id=>',1)
 match=re.search(r'(const retroURLForESPN=id=>)([^;]+);',js)
 if not match:raise RuntimeError('Cannot locate lookup')
 js=js[:match.start()]+match.group(1)+match.group(2).replace("||''","||AMERICAN_HERITAGE[String(id)]||''")+ ';'+js[match.end():]
 RENDERER.write_text(js)
 doc['status']='local_artwork_imported_with_modern_fallbacks'
 doc['imported_count']=len(files)
 doc['unresolved_count']=len(errors)
 MANIFEST.write_text(json.dumps(doc,indent=2)+'\n')
 for html in ROOT.glob('*.html'):
  s=html.read_text()
  n=re.sub(r'mbb-logo-system\.js\?v=[^"\'<>\s]+','mbb-logo-system.js?v=american-heritage-1',s)
  if n!=s:html.write_text(n)
 print(f'Installed {len(files)}/13 American vintage logo assets; {len(errors)} remain modern:')
 for ident,error in errors.items():print('UNRESOLVED',ident,error[:160])
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Build 30 checked, locally served NBA primary logos from NBA official SVG marks."""
import io, json, pathlib, urllib.request
from PIL import Image
import cairosvg

ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/'assets'/'nba-logos'
IDS={'ATL':1610612737,'BOS':1610612738,'BKN':1610612751,'CHA':1610612766,'CHI':1610612741,'CLE':1610612739,'DAL':1610612742,'DEN':1610612743,'DET':1610612765,'GSW':1610612744,'HOU':1610612745,'IND':1610612754,'LAC':1610612746,'LAL':1610612747,'MEM':1610612763,'MIA':1610612748,'MIL':1610612749,'MIN':1610612750,'NOP':1610612740,'NYK':1610612752,'OKC':1610612760,'ORL':1610612753,'PHI':1610612755,'PHX':1610612756,'POR':1610612757,'SAC':1610612758,'SAS':1610612759,'TOR':1610612761,'UTA':1610612762,'WAS':1610612764}
DEST.mkdir(parents=True,exist_ok=True)
manifest={}
errors=[]
for code,id in IDS.items():
 url=f'https://cdn.nba.com/logos/nba/{id}/primary/L/logo.svg'
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 NBA newsroom logo integrity checker','Accept':'image/svg+xml'})
  with urllib.request.urlopen(req,timeout=20) as response: svg=response.read()
  if b'<svg' not in svg[:2500]:raise ValueError('not an SVG image')
  png=cairosvg.svg2png(bytestring=svg,output_width=720,output_height=720)
  image=Image.open(io.BytesIO(png)).convert('RGBA')
  alpha=image.getchannel('A')
  box=alpha.point(lambda a:255 if a>9 else 0).getbbox()
  if not box:raise ValueError('all-transparent primary crest')
  image=image.crop(box)
  w,h=image.size
  if w<30 or h<30:raise ValueError('tiny primary crest')
  side=max(w,h); pad=round(side*.055)
  final=Image.new('RGBA',(side+2*pad,side+2*pad),(0,0,0,0))
  final.alpha_composite(image,((final.width-w)//2,(final.height-h)//2))
  target=DEST/f'{code}.png'
  final.save(target,optimize=True)
  if target.stat().st_size<1500:raise ValueError('implausibly small output')
  manifest[code]={'path':str(target.relative_to(ROOT)),'source':url,'width':final.width,'height':final.height}
  print(code,'OK',final.size,target.stat().st_size)
 except Exception as e:
  errors.append(f'{code}: {e}')
  print(code,'FAILED',e)
if errors or len(manifest)!=30:
 raise SystemExit('Logo audit FAILED: '+'; '.join(errors))
(DEST/'manifest.json').write_text(json.dumps({'league':'NBA','season':'2026-27','teams':manifest},indent=2)+'\n')
print('PASS: 30 NBA primary marks validated and generated locally')

#!/usr/bin/env python3
"""Restore Wisconsin's 1970–2003 Bucky Badger and Purdue's 1980–2006 Purdue Pete.

Archives document both exact era ranges. Every Big Ten image then receives
the same visual centering pass: remove ONLY connected blank background at
the outer edge, crop to real artwork bounds, and center in a square canvas.
Not an AI redraw; no logo is modified or recomposed beyond background trim,
resampling, and transparent padding.
"""
from collections import deque
from pathlib import Path
from PIL import Image
import io
import json
import math
import os
import requests

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/cbb-big-ten-1980s"
MANIFEST=ROOT/"data/cbb-big-ten-1980s.json"
logos=json.loads(MANIFEST.read_text())
assert len(logos["teams"])==10
SOURCES={
 "275":{
   "url":"https://content.sportslogos.net/logos/35/914/full/98ghwjc5b9qrrvjzxph8.png",
   "page":"https://www.sportslogos.net/logos/view/98ghwjc5b9qrrvjzxph8/Wisconsin-Badgers-Logo/1970/Secondary-Logo",
   "era":"1970–2003",
   "variant":"Bucky Badger mascot · walking badger with red W sweater",
 },
 "2509":{
   "url":"https://content.sportslogos.net/logos/33/809/full/purdue_boilermakers_logo_mascot_19801359.png",
   "page":"https://www.sportslogos.net/logos/view/5ffl7irto1h8lgftryz5/Purdue-Boilermakers-Logo/1980/Mascot-Logo",
   "era":"1980–2006",
   "variant":"Purdue Pete basketball mascot · hammer and basketball",
 }
}
def fetch_art(key,entry):
  url=entry["url"]
  response=requests.get(url,timeout=40,headers={
    "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36",
    "Referer":"https://www.sportslogos.net/",
    "Accept":"image/png,image/*;q=0.9",
  })
  response.raise_for_status()
  if len(response.content)<3000:raise ValueError("Historical logo not plausibly complete: "+url)
  src=Image.open(io.BytesIO(response.content));src.load()
  if min(src.size)<350:raise ValueError(f"Unacceptably small {key} historical asset {src.size}")
  print("FETCHED",key,src.size,"bytes",len(response.content),"url",url,flush=True)
  return src

def white_border_purge(img):
  """Remove only near-white flood-connected opaque background, retaining
  white lettering and fur that are enclosed by colored logo outlines."""
  img=img.convert("RGBA")
  w,h=img.size
  pixels=img.load()
  corners=[pixels[0,0],pixels[w-1,0],pixels[0,h-1],pixels[w-1,h-1]]
  # Many certified assets already have transparent backgrounds.
  if any(rgba[3]<235 for rgba in corners):
    return img
  if not all(min(p[:3])>=241 and max(p[:3])-min(p[:3])<=16 for p in corners):
    return img
  mask=bytearray(w*h)
  q=deque()
  def candidate(x,y):
    p=pixels[x,y]
    return p[3]>230 and min(p[:3])>=241 and max(p[:3])-min(p[:3])<=16
  for x in range(w):
    for y in (0,h-1):
      idx=y*w+x
      if not mask[idx] and candidate(x,y):mask[idx]=1;q.append((x,y))
  for y in range(h):
    for x in (0,w-1):
      idx=y*w+x
      if not mask[idx] and candidate(x,y):mask[idx]=1;q.append((x,y))
  while q:
    x,y=q.popleft()
    for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
      if 0<=nx<w and 0<=ny<h:
        i=ny*w+nx
        if not mask[i] and candidate(nx,ny):mask[i]=1;q.append((nx,ny))
  count=sum(mask)
  if count:
    alpha=img.getchannel("A")
    buf=bytearray(alpha.tobytes())
    for i,remove in enumerate(mask):
      if remove:buf[i]=0
    img.putalpha(Image.frombytes("L",(w,h),bytes(buf)))
  print("BORDER_TRIM",w,h,count,flush=True)
  return img

def normalize(img,id):
  img=white_border_purge(img)
  alpha=img.getchannel("A")
  # Trim transparent areas, but do not crop any authentic visible strokes.
  m=alpha.point(lambda p:255 if p>12 else 0)
  bounds=m.getbbox()
  if bounds is None:raise ValueError("Historical image is entirely transparent "+id)
  crop=img.crop(bounds)
  original=[img.width,img.height]
  # Uniform display canvas: centered exact geometric artwork bounds, with
  # 5% breathing room *within* artwork; the ring CSS has a separate inset.
  canvas_side=720
  max_art=652
  scale=min(max_art/crop.width,max_art/crop.height)
  target=(max(1,round(crop.width*scale)),max(1,round(crop.height*scale)))
  method=Image.Resampling.LANCZOS if target[0]<crop.width or target[1]<crop.height else Image.Resampling.BICUBIC
  crop=crop.resize(target,method)
  square=Image.new("RGBA",(canvas_side,canvas_side),(0,0,0,0))
  x=(canvas_side-crop.width)//2
  y=(canvas_side-crop.height)//2
  square.alpha_composite(crop,(x,y))
  visibility=square.getchannel("A").point(lambda p:255 if p>15 else 0).getbbox()
  if not visibility:raise ValueError("No visible pixels after normalization: "+id)
  cx=(visibility[0]+visibility[2])/2
  cy=(visibility[1]+visibility[3])/2
  assert abs(cx-canvas_side/2)<=1.5 and abs(cy-canvas_side/2)<=1.5,(id,cx,cy)
  # No strokes are cropped, no oval distortion.
  filename=OUT/(id+".png")
  square.save(filename,format="PNG",optimize=True)
  size=filename.stat().st_size
  assert size>=1800,(id,size)
  return {"original_px":original,"pretrim_bounds":list(bounds),"canvas_px":canvas_side,
    "visible_bounds":list(visibility),"center_offset_px":[round(cx-canvas_side/2,2),round(cy-canvas_side/2,2)],"asset_bytes":size}

for id,record in sorted(logos["teams"].items()):
  path=OUT/(id+".png")
  assert path.is_file(),f"Missing original historic logo {id}"
  if id in SOURCES:
    v=SOURCES[id]
    art=fetch_art(id,v)
    record["era"]=v["era"]
    record["source_url"]=v["page"]
    record["image_source_url"]=v["url"]
    record["variant"]=v["variant"]
  else:
    art=Image.open(path)
    art.load()
    record["variant"]=record.get("variant","historical primary")
  metric=normalize(art,id)
  record["centered_geometry"]=metric
  record["bytes"]=metric["asset_bytes"]
  print("CENTERED",id,record["school"],record["era"],metric["center_offset_px"],metric["asset_bytes"],flush=True)
assert logos["teams"]["275"]["variant"].startswith("Bucky Badger")
assert logos["teams"]["2509"]["variant"].startswith("Purdue Pete")
logos["note"]="1980s Big Ten original-school archive. Wisconsin/Purdue use era-authenticated mascot marks by owner request. All ten PNGs optically centered by visible artwork bounds, with no changes to NCAA schedule/RETRO code."
MANIFEST.write_text(json.dumps(logos,indent=2,ensure_ascii=False)+"\n")
print("PASS: Ten authentic 1980s Big Ten artwork images optically centered; Bucky and Purdue Pete locally stored.")

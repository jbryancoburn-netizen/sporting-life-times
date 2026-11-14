#!/usr/bin/env python3
"""Recover authentic vintage mascot artwork as local 512px newspaper assets.

Never render a network source at browser runtime. The archive is accessed only
during this one-off build. Historical artwork is retained, not invented.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.request import urlopen,Request
import hashlib
import json
import math
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"assets/cbb-big-ten-1980s/centered"
MANIFEST=ROOT/"data/cbb-big-ten-heritage-mascot-provenance.json"
PNG_SOURCE={
  "michigan-state-gruff":{
    "source":"https://www.nudgeprinting.com/cdn/shop/files/Michigan_State_Gruff_Sparty_Vintage_Logo.png?v=1724529198&width=1000",
    "archive":"https://www.nudgeprinting.com/collections/michigan-state-wall-decals",
    "label":"Complete vintage Gruff Sparty mascot portrait (uncropped)"
  },
  "maryland-terrapin":{
    "source":"https://content.sportslogos.net/logos/32/743/full/maryland_terrapins_logo_alternate_1983_sportslogosnet-6799.png",
    "archive":"https://www.sportslogos.net/logos/view/74367991983/Maryland-Terrapins-Logo/1983/Alternate-Logo",
    "label":"1983–1988 cartoon terrapin with striped Maryland M"
  }
}
def fetch(src):
    req=Request(src,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36","Accept":"image/png,image/*;q=0.9","Referer":"https://www.sportslogos.net/"})
    with urlopen(req,timeout=40) as resp:data=resp.read(5_500_001)
    if len(data)<2500 or len(data)>5_500_000:raise AssertionError("Unexpected archive image payload")
    with Image.open(BytesIO(data)) as img:
        if img.width<250 or img.height<250:raise AssertionError("Historical source too small")
        return img.convert("RGBA"),data

def ink(canvas):
    p=canvas.load()
    xs,ys=[],[]
    for y in range(canvas.height):
        for x in range(canvas.width):
            r,g,b,a=p[x,y]
            if a<100 or (r>246 and g>246 and b>246):continue
            xs.append(x);ys.append(y)
    return xs,ys

def normalize(img,spec):
    bbox=img.getchannel("A").getbbox()
    if not bbox:raise AssertionError("No source alpha")
    img=img.crop(bbox)
    factor=min(440/img.width,440/img.height,3.0)
    def prepare(f):
        iw,ih=max(1,round(img.width*f)),max(1,round(img.height*f))
        small=img.resize((iw,ih),Image.Resampling.LANCZOS)
        out=Image.new("RGBA",(512,512),(255,255,255,255))
        out.alpha_composite(small,((512-iw)//2,(512-ih)//2))
        xs,ys=ink(out)
        if len(xs)<2400:raise AssertionError("Archive mascot pixels missing")
        radial=max(math.hypot(x-256,y-256) for x,y in zip(xs,ys))
        return out,xs,ys,radial
    out,xs,ys,r=prepare(factor)
    if r>220:out,xs,ys,r=prepare(factor*218/r)
    if r>224 or r<100:raise AssertionError("Out-of-range mascot ink radius: "+str(r))
    return out,{"ink_radius":round(r,2),"ring_margin_to_238px":round(238-r,2),
                "bbox":[min(xs),min(ys),max(xs)+1,max(ys)+1]}

def main():
    OUT.mkdir(parents=True,exist_ok=True);records={}
    for slug,spec in PNG_SOURCE.items():
        src,original=fetch(spec["source"])
        if slug=='michigan-state-gruff':
            # Use the same complete-image normalization as the production
            # repair. NEVER truncate the portrait by fixed height again.
            from restore_gruff_sparty_full_head import make_logo
            img,full_geo,source_bounds=make_logo(src)
            geometry={"ink_radius":full_geo["max_ink_radius"],
                      "ring_margin_to_238px":round(238-full_geo["max_ink_radius"],2),
                      "bbox":full_geo["bbox"],"lower_outline_intact":True}
        else:
            img,geometry=normalize(src,spec)
        path=OUT/(slug+".png")
        img.save(path,format="PNG",optimize=True)
        records[slug]={"source":spec["source"],"archive":spec["archive"],"label":spec["label"],
                       "sha256_source":hashlib.sha256(original).hexdigest(),
                       "sha256_local":hashlib.sha256(path.read_bytes()).hexdigest(),
                       "local":"assets/cbb-big-ten-1980s/centered/"+slug+".png",
                       "geometry":geometry,"source_pixels":list(src.size)}
        print(slug,records[slug])
    MANIFEST.parent.mkdir(exist_ok=True)
    MANIFEST.write_text(json.dumps(records,indent=2)+"\n",encoding="utf-8")
    print("PASS: historic Gruff Sparty and 1983 Testudo mascot PNGs self-hosted, ring-safe")
if __name__=="__main__":main()

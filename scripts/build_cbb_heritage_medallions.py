#!/usr/bin/env python3
"""Render *actual* two-ring PNG crests from self-hosted historical team artwork.
No CSS optical offsets, no third border, and no external logos. Builds all
historical assets linked by mbb-logo-system.js, preserving originals.
"""
from __future__ import annotations
import hashlib, json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageStat
from io import BytesIO

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/cbb-heritage-medallions"
REPORT=ROOT/"data/cbb-heritage-medallions-audit.json"
SIZE=512
# Outer 18px primary ring and adjacent 18px secondary ring; interior
# illustration is safely contained inside a 214px-radius cream disk.
OUTER_R=250
MID_R=232
INNER_R=214
ART_R=202
SOURCE=(ROOT/"mbb-logo-system.js").read_text()
PAT=re.compile(r"'(\\d+)':'(assets/cbb-[^'\\?]+\\.png)\\?v=[^']+'")
PALETTE=json.loads((ROOT/"data/dual-ring-team-palette.json").read_text())["mbb"]
entries=PAT.findall(SOURCE)
if len(entries)<75 or len(set(id for id,_ in entries))!=len(entries):
    raise SystemExit("Historical-team ID coverage is incomplete or ambiguous: "+str(len(entries)))

def school_color(value):
    if not isinstance(value,str) or not re.fullmatch(r"#[0-9a-fA-F]{6}",value):
        raise ValueError("Invalid verified school color: "+str(value))
    return value

def bounds_and_mask(src):
    # For transparent PNGs, analyze the actual alpha. For opaque artwork,
    # only trim *uniform white or cream page margins*, not school-color fields.
    a=src.getchannel("A")
    if a.getextrema()[0]<245:
        foreground=a.point(lambda v:255 if v>=12 else 0)
    else:
        pixels=src.load()
        corners=[pixels[x,y] for x,y in [(0,0),(src.width-1,0),(0,src.height-1),(src.width-1,src.height-1)]]
        brightness=[min(p[:3]) for p in corners]
        spread=max(max(c[:3])-min(c[:3]) for c in corners)
        if min(brightness)>218 and spread<38:
            from PIL import ImageColor
            import math
            bg=tuple(round(sum(c[k] for c in corners)/4) for k in range(3))
            rgb=src.convert("RGB")
            foreground=Image.new("L",src.size,0)
            fp=foreground.load()
            px=rgb.load()
            for y in range(src.height):
                for x in range(src.width):
                    p=px[x,y]
                    # White text inside colored marks stays intact; this mask
                    # only determines the bounding rectangle, never deletes ink.
                    if max(abs(p[k]-bg[k]) for k in range(3))>24:
                        fp[x,y]=255
            if not foreground.getbbox():foreground=Image.new("L",src.size,255)
        else:
            foreground=Image.new("L",src.size,255)
    return foreground.getbbox() or (0,0,src.width,src.height)

def make_medallion(src,primary,secondary):
    image=src.convert("RGBA")
    bb=bounds_and_mask(image)
    # A small source-space safety margin guarantees antialiased features are kept.
    margin=max(3,round(max(bb[2]-bb[0],bb[3]-bb[1])*.012))
    bb=(max(0,bb[0]-margin),max(0,bb[1]-margin),
        min(src.width,bb[2]+margin),min(src.height,bb[3]+margin))
    art=image.crop(bb)
    fit=ART_R*2
    scale=min(fit/art.width,fit/art.height)
    w,h=max(1,int(art.width*scale)),max(1,int(art.height*scale))
    art=art.resize((w,h),Image.Resampling.LANCZOS)
    canvas=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
    d=ImageDraw.Draw(canvas)
    # Precisely two contiguous school-color rings, not CSS or image borders.
    d.ellipse((6,6,506,506),fill=primary)
    d.ellipse((24,24,488,488),fill=secondary)
    d.ellipse((42,42,470,470),fill=(251,247,236,255))
    # A clear paper disk under the original art (not a third ring).
    layer=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
    layer.alpha_composite(art,((SIZE-w)//2,(SIZE-h)//2))
    mask=Image.new("L",(SIZE,SIZE),0)
    ImageDraw.Draw(mask).ellipse((SIZE//2-ART_R,SIZE//2-ART_R,SIZE//2+ART_R,SIZE//2+ART_R),fill=255)
    alpha=ImageChops.multiply(layer.getchannel("A"),mask)
    if ImageChops.difference(layer.getchannel("A"),alpha).getbbox():
        raise ValueError("Source art would clip at the circular safety zone")
    layer.putalpha(alpha)
    canvas.alpha_composite(layer)
    return canvas,bb,(w,h)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    records=[]
    seen=set()
    for id,relative in entries:
        palette=PALETTE.get(id)
        if not palette:
            raise ValueError("No verified school palette: ESPN "+id)
        primary=school_color(palette.get("primary"))
        secondary=school_color(palette.get("secondary"))
        if primary.lower()==secondary.lower():
            raise ValueError("Duplicate ring colors for ESPN "+id)
        file=ROOT/relative
        if not file.is_file():raise ValueError("Missing real archived artwork: "+relative)
        with Image.open(file) as original:
            original.load()
            png,bounds,scale=make_medallion(original,primary,secondary)
        output=OUT/(id+".png")
        png.save(output,"PNG",optimize=True)
        digest=hashlib.sha256(output.read_bytes()).hexdigest()
        seen.add(id)
        records.append(dict(espn_id=id,source=relative,asset=str(output.relative_to(ROOT)),
            source_bbox=list(bounds),art_size=list(scale),sha256=digest,
            ring_colors=[primary,secondary],original_sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
    records.sort(key=lambda v:int(v["espn_id"]))
    if len(seen)!=len(entries):
        raise AssertionError("One or more historical logos was not built")
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(dict(format="baked-two-ring-crest-v1",canvas=SIZE,
        source_count=len(entries),rendered_count=len(records),records=records),indent=2)+"\\n")
    print("PASS: built "+str(len(records))+" high-resolution two-ring heritage PNGs without editing source art")

if __name__=="__main__":main()

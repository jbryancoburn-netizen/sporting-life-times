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
PAT=re.compile(r"'(\d+)':'(assets/cbb-[^'?]+\.png)\?v=[^']+'")
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
    # Remove *only* page-colored background connected to a corner. Preserve
    # enclosed white mascot lettering, eyes and other historical artwork.
    corners=[image.getpixel(pt) for pt in [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]]
    if (all(p[3]>=245 and min(p[:3])>=218 for p in corners)
            and max(max(p[:3])-min(p[:3]) for p in corners)<38):
        for pt in [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]:
            if image.getpixel(pt)[3]>=245 and min(image.getpixel(pt)[:3])>=218:
                ImageDraw.floodfill(image,pt,(0,0,0,0),thresh=18)
    bbox=image.getchannel("A").point(lambda v:255 if v>=12 else 0).getbbox()
    if not bbox:raise ValueError("No visible archived mascot")
    margin=max(3,round(max(bbox[2]-bbox[0],bbox[3]-bbox[1])*.013))
    bbox=(max(0,bbox[0]-margin),max(0,bbox[1]-margin),
        min(src.width,bbox[2]+margin),min(src.height,bbox[3]+margin))
    cropped=image.crop(bbox)
    # Start with large artwork, shrinking only if real painted pixels would
    # intersect the protected inside edge of the two-ring medallion.
    art=None
    for max_edge in range(400,270,-10):
        scale=min(max_edge/cropped.width,max_edge/cropped.height)
        w,h=max(1,round(cropped.width*scale)),max(1,round(cropped.height*scale))
        trial=cropped.resize((w,h),Image.Resampling.LANCZOS)
        test=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
        test.alpha_composite(trial,((SIZE-w)//2,(SIZE-h)//2))
        disk=Image.new("L",(SIZE,SIZE),0)
        ImageDraw.Draw(disk).ellipse((SIZE//2-ART_R,SIZE//2-ART_R,SIZE//2+ART_R,SIZE//2+ART_R),fill=255)
        violation=ImageChops.subtract(test.getchannel("A"),disk)
        if not violation.getbbox():
            art=test
            chosen=(w,h)
            break
    if art is None:
        raise ValueError("Archival image extends beyond safe crest circle: manual artwork review required")
    canvas=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
    d=ImageDraw.Draw(canvas)
    d.ellipse((6,6,506,506),fill=primary)
    d.ellipse((24,24,488,488),fill=secondary)
    d.ellipse((42,42,470,470),fill=(251,247,236,255))
    canvas.alpha_composite(art)
    return canvas,bbox,chosen

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
        source_count=len(entries),rendered_count=len(records),records=records),indent=2)+"\n")
    print("PASS: built "+str(len(records))+" high-resolution two-ring heritage PNGs without editing source art")

if __name__=="__main__":main()

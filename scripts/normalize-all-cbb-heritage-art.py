#!/usr/bin/env python3
"""Normalize undersized LOCAL vintage CBB source PNGs, never badge CSS.

Run from repository root with Pillow. Preserves each original logo's full
visible artwork and aspect ratio; never guesses a replacement team identity.
Only enlarge source canvases that actually have substantial transparent
margins. Reject logos with nontransparent image edges (uncropped opaque art).
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image
import json, re, sys

ROOT=Path(__file__).resolve().parent.parent
SOURCE=(ROOT/"mbb-logo-system.js").read_text()
# Only assets served by the authoritative MBB/WBB renderer.
URL_PATTERN=re.compile(r"assets/cbb-[^'\\\"?]+\\.png\\?v=[A-Za-z0-9._-]+")
TARGET_EDGE=400   # content max dimension, within 512px two-ring-safe shell
MIN_EDGE=360      # do not churn already suitably sized heritage art
CANVAS=512
files=sorted(set(m.group(0).split("?")[0] for m in URL_PATTERN.finditer(SOURCE)))
if len(files)<75:
    raise SystemExit(f"ABORT: expected at least 75 local vintage PNGs, found {len(files)}")
report=[]
changed=[]
for relative in files:
    path=ROOT/relative
    if not path.is_file():
        raise SystemExit(f"Missing published crest: {relative}")
    im=Image.open(path).convert("RGBA")
    if im.width!=im.height:
        raise SystemExit(f"Unexpected non-square source art: {relative} is {im.size}")
    a=im.getchannel("A")
    # Anti-aliased contours can contain nearly invisible stray pixels.
    bb=a.point(lambda v:255 if v>=12 else 0).getbbox()
    if not bb:
        raise SystemExit(f"Empty crest: {relative}")
    w,h=bb[2]-bb[0],bb[3]-bb[1]
    edge=max(w,h)
    # Only transparent padding: do not override/trim background art or
    # images already fitted. Avoid cropping real painted edges.
    has_padding=bb[0]>=8 and bb[1]>=8 and bb[2]<=im.width-8 and bb[3]<=im.height-8
    action="unchanged"
    if (im.size!=(CANVAS,CANVAS) or edge<MIN_EDGE) and has_padding:
        # Fixed alpha-space crop, preserving all antialiased edge pixels.
        actual=a.point(lambda v:255 if v>=2 else 0).getbbox()
        x0,y0,x1,y1=actual
        art=im.crop(actual)
        scale=TARGET_EDGE/max(art.size)
        newsize=(max(1,round(art.width*scale)),max(1,round(art.height*scale)))
        art=art.resize(newsize,Image.Resampling.LANCZOS)
        result=Image.new("RGBA",(CANVAS,CANVAS),(0,0,0,0))
        result.alpha_composite(art,((CANVAS-art.width)//2,(CANVAS-art.height)//2))
        result.save(path,"PNG",optimize=True)
        newbb=result.getchannel("A").point(lambda v:255 if v>=12 else 0).getbbox()
        if not newbb or max(newbb[2]-newbb[0],newbb[3]-newbb[1])<MIN_EDGE:
            raise SystemExit(f"Post-normalization size invalid: {relative}")
        action="normalized"
        changed.append(relative)
    elif edge<MIN_EDGE or im.size!=(CANVAS,CANVAS):
        action="manual_review_nontransparent_edge"
    report.append({"asset":relative,"source_visible_edge_px":edge,
                   "source_bbox":list(bb),"action":action})
out=ROOT/"data"/"cbb-heritage-optical-audit.json"
out.write_text(json.dumps({"canvas":CANVAS,"target_visible_edge_px":TARGET_EDGE,
                            "source_count":len(files),"normalized_count":len(changed),
                            "files":report},indent=2)+"\n")
print(f"TOTAL {len(files)} vintage crests; NORMALIZED {len(changed)}; "
      f"MANUAL {sum(x['action'].startswith('manual') for x in report)}")
for x in report:
    if x["action"]!="unchanged":
        print(f"{x['action'].upper():12} {x['source_visible_edge_px']:3} {x['asset']}")
if __name__=="__main__":
    pass

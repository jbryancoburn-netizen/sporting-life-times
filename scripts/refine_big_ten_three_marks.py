#!/usr/bin/env python3
"""One-time source-art QA correction: Northwestern, Goldy and Purdue Pete.

Only changes image pixels on a fixed 512px white canvas. Does not use JS or
per-school CSS positioning. Input Git blobs are pinned to prevent accidental
repeated enlargement. The same source path serves gallery and ledger mockups.
"""
from __future__ import annotations

from collections import defaultdict
from io import BytesIO
from pathlib import Path
import hashlib
import json
import math
import re

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets/cbb-big-ten-1980s/centered"
PAGE = ROOT / "cbb-big-ten-1980s-preview.html"
SIDE = 512
CENTER = SIDE / 2
# Exact Git blob SHA of the images approved in PR #351; refuse to double-scale.
EXPECTED = {
    "northwestern": "8fb23914d36ffe66e66f464440cbba53936a7289",
    "minnesota": "f01453129c3f364ff08e1f026068b569392972ab",
    "purdue": "52f3356522ebe11ea48be8026a22b738088231f1",
}
# Fill more of the standard circle while keeping the full mascot image intact.
TARGET_LONG = {"minnesota": 468, "purdue": 466}
VERSION = "20261113-optical-v2"

def git_blob_sha(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()

def foreground(image):
    # Works for the white-background archival originals and opaque logo pixels.
    data = image.convert("RGBA")
    xs, ys, masses = [], [], []
    for y in range(data.height):
        for x in range(data.width):
            r,g,b,a = data.getpixel((x,y))
            if a < 100 or (r >= 241 and g >= 241 and b >= 241):
                continue
            xs.append(x)
            ys.append(y)
            masses.append(max(1, 255-min(r,g,b)))
    if len(xs) < 80:
        raise RuntimeError("Expected logo foreground was missing")
    return xs, ys, masses

def stats(image):
    xs, ys, masses = foreground(image)
    total = sum(masses)
    xlo,xhi,ylo,yhi = min(xs),max(xs)+1,min(ys),max(ys)+1
    cx = sum(x*m for x,m in zip(xs,masses))/total
    cy = sum(y*m for y,m in zip(ys,masses))/total
    # Quantify how much real art would be under the ring/clip on 104px mobile.
    outside = sum(1 for x,y in zip(xs,ys) if (x-CENTER)**2+(y-CENTER)**2 > 238**2)
    return {"bounds":[xlo,ylo,xhi,yhi],
            "bbox_center":[round((xlo+xhi)/2,1),round((ylo+yhi)/2,1)],
            "mass_center":[round(cx,1),round(cy,1)],
            "ink_pixels":len(xs), "outside_ring_fraction":round(outside/len(xs),5)}

def paste_white(art, x, y):
    canvas=Image.new("RGBA",(SIDE,SIDE),(255,255,255,255))
    canvas.alpha_composite(art,(x,y))
    return canvas

def fix_northwestern(image):
    old=stats(image)
    # The visible N + mascot has a left-heavy silhouette even with a
    # mathematically centered bounding box. Shift the pixels, not the CSS.
    cx,cy=old["mass_center"]
    bx,by=old["bbox_center"]
    dx=round(max(-16,min(16,0.72*(CENTER-cx)+0.28*(CENTER-bx))))
    dy=round(max(-12,min(12,0.65*(CENTER-cy)+0.35*(CENTER-by))))
    new=paste_white(image,(dx),(dy))
    return new, {"shift_pixels":[dx,dy], "scale":1.0}

def enlarge_mascot(image, target):
    old=stats(image)
    x0,y0,x1,y1=old["bounds"]
    pad=3
    x0=max(0,x0-pad);y0=max(0,y0-pad)
    x1=min(SIDE,x1+pad);y1=min(SIDE,y1+pad)
    art=image.crop((x0,y0,x1,y1))
    ratio=target/max(art.size)
    newsize=(round(art.width*ratio),round(art.height*ratio))
    resized=art.resize(newsize,Image.Resampling.LANCZOS)
    # Mathematical centering inside the circle; same layout for both genders.
    centered=paste_white(resized,(SIDE-resized.width)//2,(SIDE-resized.height)//2)
    result=stats(centered)
    if max(abs(v-CENTER) for v in result["bbox_center"]) > 5.5:
        raise AssertionError("Enlarged mascot is off-center")
    if result["outside_ring_fraction"] > 0.07:
        raise AssertionError("Enlarged mascot could have substantial ring clipping")
    return centered, {"old_long":max(old["bounds"][2]-old["bounds"][0],old["bounds"][3]-old["bounds"][1]),
                      "new_long":max(result["bounds"][2]-result["bounds"][0],result["bounds"][3]-result["bounds"][1]),
                      "requested_long":target,
                      "scale":round(ratio,3)}

def main():
    report={"intent":"Static source-asset alignment and size, no CSS or JS offsets","teams":{}}
    for school,blob in EXPECTED.items():
        f=ASSETS/(school+".png")
        raw=f.read_bytes()
        assert git_blob_sha(raw)==blob, f"Source changed unexpectedly: {f}; stop rather than double-enlarge"
        image=Image.open(BytesIO(raw)).convert("RGBA")
        assert image.size==(SIDE,SIDE)
        before=stats(image)
        output,details=(fix_northwestern(image) if school=="northwestern"
                        else enlarge_mascot(image,TARGET_LONG[school]))
        after=stats(output)
        if school=="northwestern":
            # Northwesterner's real silhouette needs to move, not change size.
            if details["shift_pixels"]==[0,0]:
                raise AssertionError("Northwestern received no optical correction")
        else:
            if details["new_long"] <= details["old_long"]*1.065:
                raise AssertionError("Mascot was not visibly enlarged")
        report["teams"][school]={"before":before,"after":after,**details}
        output.save(f,format="PNG",optimize=True)

    original=PAGE.read_text()
    for name in EXPECTED:
        plain=f"assets/cbb-big-ten-1980s/centered/{name}.png"
        if name in ("northwestern","minnesota") and original.count('src="'+plain+'"')!=1:
            raise AssertionError("Missing original gallery image: "+name)
        if name=="purdue" and original.count('src="'+plain+'"')!=2:
            raise AssertionError("Expected gallery and mock ledger Purdue images")
        original=original.replace('src="'+plain+'"','src="'+plain+'?v='+VERSION+'"')
    assert original.count("?v="+VERSION)==4
    assert original.count('<img src="assets/cbb-big-ten-1980s/centered/')==14
    assert "cbb-big-ten-optical-center" not in original and "--slt-ink-" not in original
    original=original.replace("Ten verified historic emblems · Images embedded",
                              "Ten original-era emblems · Stored locally")
    original=original.replace("stored in the newspaper repository and embedded directly in this preview",
                              "stored locally in the newspaper repository and loaded directly by this preview")
    PAGE.write_text(original)
    (ROOT/"reports").mkdir(exist_ok=True)
    (ROOT/"reports/big-ten-mascot-optical-qa.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    print("PASS: 3 source PNG corrections, 14 retained placements, cache-busted art, no CSS/JS offsets")

if __name__=="__main__":
    main()

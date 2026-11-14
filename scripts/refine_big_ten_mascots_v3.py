#!/usr/bin/env python3
"""Recenter the visible ink of two original 1980s Big Ten mascot PNGs.

This alters only source artwork pixels on existing 512x512 canvases. It keeps
the user's Minnesota gopher and the archival Purdue Pete illustration intact;
the HTML/CSS rings and renderer are never repositioned or resized.
"""
from __future__ import annotations

import hashlib
from io import BytesIO
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets/cbb-big-ten-1980s/centered"
PAGE = ROOT / "cbb-big-ten-1980s-preview.html"
REPORT = ROOT / "reports/big-ten-mascot-ring-clearance-v3.json"
SIDE = 512
PINNED_SHA = {
    "minnesota": "8ae1c06954d0072d9fe724747cc5774d9be22744",
    "purdue": "a36001c511a9de50d0270cb95b686ad2e1669535"
}
# The last pass overshot both mascots: 462 and 460px of visible art.
# Split the difference with the earlier 426/422px pass, add slight optical
# corrections, and leave extra white space before the fixed inner ring.
TARGET = {
    "minnesota": {"long": 440, "x": -5, "y": +8},
    "purdue": {"long": 438, "x": +4, "y": +3}
}
OLD_VERSION = "20261113-optical-v2"
NEW_VERSION = "20261114-ring-safe-v3"

def git_sha(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\x00" + raw).hexdigest()

def measure(im):
    assert im.size == (SIDE, SIDE)
    im = im.convert("RGBA")
    xs, ys, masses = [], [], []
    rad_out_238 = 0
    rad_out_224 = 0
    for y in range(SIDE):
        for x in range(SIDE):
            r, g, b, alpha = im.getpixel((x, y))
            if alpha < 100 or (r >= 241 and g >= 241 and b >= 241):
                continue
            xs.append(x); ys.append(y)
            masses.append(max(1, 255-min(r,g,b)))
            dist = (x-256)**2+(y-256)**2
            rad_out_238 += dist > 238**2
            rad_out_224 += dist > 224**2
    assert len(xs) > 1000, "Mascot ink disappeared unexpectedly"
    total = sum(masses)
    bbox = [min(xs), min(ys), max(xs)+1, max(ys)+1]
    centroid = [sum(x*m for x,m in zip(xs,masses))/total,
                sum(y*m for y,m in zip(ys,masses))/total]
    return {
        "bounds": bbox,
        "long_px": max(bbox[2]-bbox[0], bbox[3]-bbox[1]),
        "ink_center": [round(c, 2) for c in centroid],
        "centroid_error": round(((centroid[0]-256)**2+(centroid[1]-256)**2)**.5, 2),
        "outside_radius_238_fraction": round(rad_out_238/len(xs), 5),
        "outside_radius_224_fraction": round(rad_out_224/len(xs), 5),
        "ink_pixels": len(xs)
    }

def safe_mascot_image(img, target):
    a=measure(img)
    x0,y0,x1,y1=a["bounds"]
    # Retain the signature, ball, stripework, limbs, tail and small trademarks.
    pad=3
    region=img.crop((max(0,x0-pad),max(0,y0-pad),
                     min(SIDE,x1+pad),min(SIDE,y1+pad)))
    ratio=target["long"]/max(region.width,region.height)
    dims=(max(1,round(region.width*ratio)),max(1,round(region.height*ratio)))
    foreground=region.resize(dims,Image.Resampling.LANCZOS)
    result=Image.new("RGBA",(SIDE,SIDE),(255,255,255,255))
    x=(SIDE-dims[0])//2+target["x"]
    y=(SIDE-dims[1])//2+target["y"]
    if min(x,y)<3 or x+dims[0]>SIDE-3 or y+dims[1]>SIDE-3:
        raise AssertionError("Mascot touches source canvas edge")
    result.alpha_composite(foreground,(x,y))
    return result

def main():
    report={"policy":"Source artwork only; plain centered CSS unchanged",
            "model":"fixed rings and two-color borders, no new CSS/JS offsets",
            "teams":{}}
    for team,target in TARGET.items():
        path=IMAGES/(team+".png")
        raw=path.read_bytes()
        if git_sha(raw)!=PINNED_SHA[team]:
            raise AssertionError(f"Input artwork changed: {team}, refusing repeated transform")
        original=Image.open(BytesIO(raw)).convert("RGBA")
        before=measure(original)
        result=safe_mascot_image(original,target)
        after=measure(result)
        # Both ring-boundary crowding and optical centering must improve.
        if after["long_px"]>=before["long_px"] or after["long_px"]<420:
            raise AssertionError(f"{team} logo size outside balanced range")
        if after["centroid_error"]>=before["centroid_error"]:
            raise AssertionError(f"{team} visual ink center did not improve")
        if after["outside_radius_238_fraction"]>=before["outside_radius_238_fraction"]:
            raise AssertionError(f"{team} image still crowds inner ring")
        report["teams"][team]={"before":before,"after":after,
          "target_long":target["long"],"optical_shift":[target["x"],target["y"]]}
        result.save(path,format="PNG",optimize=True)

    html=PAGE.read_text(encoding="utf-8")
    for team,number in [("minnesota",1),("purdue",2)]:
        old=f"assets/cbb-big-ten-1980s/centered/{team}.png?v={OLD_VERSION}"
        new=f"assets/cbb-big-ten-1980s/centered/{team}.png?v={NEW_VERSION}"
        if html.count(old)!=number:
            raise AssertionError(f"{team}: unexpected gallery/ledger reference count")
        html=html.replace(old,new)
    assert html.count(f"?v={NEW_VERSION}")==3
    assert html.count('<img src="assets/cbb-big-ten-1980s/centered/')==14
    assert "--slt-ink-" not in html and "cbb-big-ten-optical-center" not in html
    PAGE.write_text(html,encoding="utf-8")
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    print("PASS: 2 optically rebalanced PNGs, 3 cache-refreshed uses, 14 intact logo placements")

if __name__=="__main__":
    main()

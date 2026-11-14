#!/usr/bin/env python3
"""One-time moderate enlargement of the original Purdue Pete PNG.

Make source artwork fit inside the *circular* opening, not just a rectangular
512x512 image. Preserve original color/pose, typography, and all visible ink.
No CSS, JavaScript positioning, altered rings, or external image hosting.
"""
from __future__ import annotations

import hashlib
from io import BytesIO
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGE = ROOT / "assets/cbb-big-ten-1980s/centered/purdue.png"
PREVIEW = ROOT / "cbb-big-ten-1980s-preview.html"
REPORT = ROOT / "reports/purdue-pete-balanced-v5.json"
INPUT_SHA = "4f7dc28ebe788429039786f65b26efa8fecc60c5"
VERSION_BEFORE = "20261114-pete-circle-safe-v4"
VERSION_AFTER = "20261114-pete-balanced-v5"
SIDE = 512
CENTER = SIDE / 2
# Fit the full diagonal mascot silhouette within a 228px radial envelope,
# retaining at least 10px breathing room before the 238px safe boundary.
# Target longest ink dimension ~330px, versus 300px in the last undersized pass.
MAX_INK_RADIUS = 228.0


def sha(raw: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def ink_pixels(image: Image.Image):
    image = image.convert("RGBA")
    found = []
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = image.getpixel((x,y))
            if a < 100 or (r >= 241 and g >= 241 and b >= 241):
                continue
            found.append((x, y, max(1, 255 - min(r,g,b))))
    if len(found) < 2000:
        raise AssertionError("Historic Purdue artwork has too little visible ink")
    return found


def metrics(im: Image.Image):
    points=ink_pixels(im)
    m=sum(w for x,y,w in points)
    cx=sum(x*w for x,y,w in points)/m
    cy=sum(y*w for x,y,w in points)/m
    maxrad=max(math.hypot(x-cx, y-cy) for x,y,w in points)
    outputrad=max(math.hypot(x-CENTER, y-CENTER) for x,y,w in points)
    x0=min(x for x,y,w in points)
    y0=min(y for x,y,w in points)
    x1=max(x for x,y,w in points)+1
    y1=max(y for x,y,w in points)+1
    outside238=sum(math.hypot(x-CENTER,y-CENTER)>238 for x,y,w in points)/len(points)
    return {
        "bounds": [x0,y0,x1,y1],
        "ink_count":len(points),
        "ink_centroid":[round(cx,2),round(cy,2)],
        "centroid_error_px": round(math.hypot(cx-CENTER,cy-CENTER),2),
        "max_radius_from_ink_centroid_px":round(maxrad,2),
        "max_radius_from_canvas_center_px":round(outputrad,2),
        "pixels_outside_prior_238px_circle_fraction":round(outside238,6),
        "longest_bbox_dimension_px":max(x1-x0,y1-y0)
    }


def fit_inside_circle(original: Image.Image) -> Image.Image:
    before=metrics(original)
    (x0,y0,x1,y1)=before["bounds"]
    left=max(0,x0-3); top=max(0,y0-3)
    right=min(SIDE,x1+3); bottom=min(SIDE,y1+3)
    region=original.crop((left,top,right,bottom))
    # Use a small reserve for resampling artifacts and edge antialiasing.
    factor=(MAX_INK_RADIUS-3)/before["max_radius_from_ink_centroid_px"]
    w=max(1,round(region.width*factor))
    h=max(1,round(region.height*factor))
    resampled=region.resize((w,h),Image.Resampling.LANCZOS)
    src_cx,src_cy=before["ink_centroid"]
    posx=round(CENTER-(src_cx-left)*(w/region.width))
    posy=round(CENTER-(src_cy-top)*(h/region.height))
    if min(posx,posy)<4 or posx+w>SIDE-4 or posy+h>SIDE-4:
        raise AssertionError("Purdue Pete touched a 512px edge after normalization")
    out=Image.new("RGBA",(SIDE,SIDE),(255,255,255,255))
    out.alpha_composite(resampled,(posx,posy))
    return out


def main():
    original_bytes=IMAGE.read_bytes()
    if sha(original_bytes)!=INPUT_SHA:
        raise AssertionError("Purdue source asset was changed; refuse rescaling a different image")
    original=Image.open(BytesIO(original_bytes)).convert("RGBA")
    if original.size!=(SIDE,SIDE):
        raise AssertionError("Unexpected historical artwork canvas size")
    before=metrics(original)
    after_image=fit_inside_circle(original)
    after=metrics(after_image)
    if after["max_radius_from_canvas_center_px"]>MAX_INK_RADIUS+2:
        raise AssertionError(f"Still crowded around circular ring: {after}")
    if after["centroid_error_px"]>2.5:
        raise AssertionError(f"Visual silhouette still off center: {after}")
    if after["pixels_outside_prior_238px_circle_fraction"]!=0:
        raise AssertionError("Any visible image pixels beyond the prior ring test")
    if not 320 <= after["longest_bbox_dimension_px"] <= 345:
        raise AssertionError(f"Purdue Pete did not reach a balanced larger size: {after}")
    if 238 - after["max_radius_from_canvas_center_px"] < 10:
        raise AssertionError("Purdue Pete still does not have sufficient ring clearance")
    if after["longest_bbox_dimension_px"] <= before["longest_bbox_dimension_px"]:
        raise AssertionError("Purdue Pete did not get larger")

    page=PREVIEW.read_text(encoding="utf-8")
    old=f"assets/cbb-big-ten-1980s/centered/purdue.png?v={VERSION_BEFORE}"
    new=f"assets/cbb-big-ten-1980s/centered/purdue.png?v={VERSION_AFTER}"
    if page.count(old)!=2:
        raise AssertionError("Expected both the gallery and example scorebug to use Purdue Pete")
    page=page.replace(old,new)
    if page.count(f"?v={VERSION_AFTER}")!=2:
        raise AssertionError("Cache-busted Purdue references mismatch")
    if page.count('<img src="assets/cbb-big-ten-1980s/centered/')!=14:
        raise AssertionError("Big Ten gallery changed unexpectedly")
    if "--slt-ink-" in page or "cbb-big-ten-optical-center" in page:
        raise AssertionError("Client-side layout workarounds must remain absent")

    after_image.save(IMAGE,format="PNG",optimize=True)
    PREVIEW.write_text(page,encoding="utf-8")
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps({
        "scope":"Purdue Pete source PNG only, fixed ring untouched",
        "before":before,
        "after":after,
        "minimum_radial_inset_from_prior_238px_check_px":
            round(238-after["max_radius_from_canvas_center_px"],2),
        "relative_bbox_scale":round(after["longest_bbox_dimension_px"]/before["longest_bbox_dimension_px"],3),
        "gallery_and_scorebug_references":2,
        "logo_references_unchanged":14,
        "browser_position_overrides_added":0
    },indent=2)+"\n",encoding="utf-8")
    print(REPORT.read_text())


if __name__=="__main__":
    main()

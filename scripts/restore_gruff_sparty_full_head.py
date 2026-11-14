#!/usr/bin/env python3
"""Replace cropped Gruff Sparty with a COMPLETE real vintage mascot portrait.

The original 2026-11-14 asset was cut at 75.5% source height, mistakenly
removing the bottom of Sparty's chin. This one-off export uses an independent,
uncropped, officially licensed vintage Gruff head source from an MSU alumni
business. It samples all visible source pixels, scales the ENTIRE drawing
into a 512px local PNG, and keeps both existing colored crest rings intact.
No browser-side cropping, CSS offsets, fabricated art or external runtime URLs.
"""
from __future__ import annotations

import hashlib
import json
import math
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSET = ROOT / "assets/cbb-big-ten-1980s/centered/michigan-state-gruff.png"
MANIFEST = ROOT / "data/cbb-big-ten-heritage-mascot-provenance.json"
PAGE = ROOT / "cbb-big-ten-1980s-preview.html"
LOGO_SCRIPT = ROOT / "mbb-logo-system.js"
SOURCE = "https://www.nudgeprinting.com/cdn/shop/files/Michigan_State_Gruff_Sparty_Vintage_Logo.png?v=1724529198&width=1000"
SOURCE_PAGE = "https://www.nudgeprinting.com/collections/michigan-state-wall-decals"
OLD_Q = "20261114-bigten-live1"
NEW_Q = "20261114-gruff-full-art1"
PINNED_OLD_BLOB = "71f38a6d1a1a3e38cdc9d142015b5b14d44e8542"
S = 512


def blob_sha(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def visible_bbox(img):
    """Find every visible colored source pixel, excluding only white background."""
    img = img.convert("RGBA")
    px = img.load()
    xs, ys = [], []
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 80 or (r >= 245 and g >= 245 and b >= 245):
                continue
            xs.append(x)
            ys.append(y)
    if len(xs) < 3500:
        raise AssertionError("Original Gruff Sparty illustration is missing")
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def ink_geometry(img):
    px = img.load()
    points = []
    for y in range(S):
        for x in range(S):
            r, g, b, a = px[x, y]
            if a < 80 or (r >= 245 and g >= 245 and b >= 245):
                continue
            points.append((x, y))
    if len(points) < 3500:
        raise AssertionError("Finished Gruff logo lost too much art")
    return {
        "bbox": [min(x for x, y in points), min(y for x, y in points),
                 max(x for x, y in points) + 1, max(y for x, y in points) + 1],
        "ink_count": len(points),
        "max_ink_radius": round(max(math.hypot(x-256, y-256) for x, y in points), 2)
    }


def fetch():
    req = Request(SOURCE, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36",
        "Accept": "image/png,image/*;q=0.9",
        "Referer": "https://www.nudgeprinting.com/"})
    with urlopen(req, timeout=40) as response:
        raw = response.read(5_500_001)
    if not 5000 < len(raw) < 5_500_000:
        raise AssertionError("Historical logo source is unreadable or too small")
    with Image.open(BytesIO(raw)) as img:
        source = img.convert("RGBA")
    if min(source.size) < 450:
        raise AssertionError("Need genuine high-resolution archival mascot asset")
    return source, raw


def make_logo(source):
    bounds = visible_bbox(source)
    # No removal of bottom 24.5%: this bbox includes the full chin, helmet,
    # cheek, curl, and registration mark, unlike the prior fixed-ratio crop.
    left, top, right, bottom = bounds
    pad = 6
    cropped = source.crop((max(0,left-pad),max(0,top-pad),
                           min(source.width,right+pad),min(source.height,bottom+pad)))
    scale = min(442/cropped.width,442/cropped.height)
    def fit(factor):
        dims = (max(1,round(cropped.width*factor)),
                max(1,round(cropped.height*factor)))
        resized = cropped.resize(dims, Image.Resampling.LANCZOS)
        output = Image.new("RGBA",(S,S),(255,255,255,255))
        output.alpha_composite(resized,((S-dims[0])//2,(S-dims[1])//2))
        return output,ink_geometry(output)
    out, geo = fit(scale)
    if geo["max_ink_radius"] > 216:
        out, geo = fit(scale*(214.5/geo["max_ink_radius"]))
    if geo["max_ink_radius"] > 218:
        raise AssertionError("Mascot still crowds the inside of the double ring")
    bx = geo["bbox"]
    if min(bx[0],bx[1],S-bx[2],S-bx[3]) < 25:
        raise AssertionError("A portion of Sparty is touching the image boundary")
    if bx[3] < 365:
        raise AssertionError("Chin still prematurely truncated (too high above bottom)")
    return out,geo,bounds


def change_version(source_text, old, new, count, label):
    observed=source_text.count(old)
    if observed!=count:
        raise AssertionError(f"{label}: expected {count} references, found {observed}")
    return source_text.replace(old,new)


def main():
    old_raw = ASSET.read_bytes()
    if blob_sha(old_raw)!=PINNED_OLD_BLOB:
        raise AssertionError("The logo changed. Do not overwrite unfamiliar art")
    source,raw = fetch()
    artwork,geometry,source_bbox = make_logo(source)
    before=PAGE.read_text("utf-8")
    script=LOGO_SCRIPT.read_text("utf-8")
    old_ref="michigan-state-gruff.png?v="+OLD_Q
    new_ref="michigan-state-gruff.png?v="+NEW_Q
    before=change_version(before,old_ref,new_ref,2,"preview and sample scorebug")
    script=change_version(script,old_ref,new_ref,1,"central logo identity map")
    if before.count('<article class="school">')!=18:
        raise AssertionError("Big Ten gallery lost a school")
    if script.count("assets/cbb-big-ten-1980s/centered/")!=18:
        raise AssertionError("18-team production mapping changed")
    manifest=json.loads(MANIFEST.read_text("utf-8"))
    entry=manifest["michigan-state-gruff"]
    entry.update({
        "source":SOURCE,
        "archive":SOURCE_PAGE,
        "label":"Complete vintage Gruff Sparty head, restored lower chin and helmet; no cropping",
        "sha256_source":hashlib.sha256(raw).hexdigest(),
        "source_pixels":list(source.size),
        "source_visible_bbox":list(source_bbox),
        "source_crop_top_ratio":None,
        "local":str(ASSET.relative_to(ROOT)),
        "geometry":{
            "ink_radius":geometry["max_ink_radius"],
            "ring_margin_to_238px":round(238-geometry["max_ink_radius"],2),
            "bbox":geometry["bbox"],
            "ink_pixels":geometry["ink_count"],
            "lower_outline_intact":True
        }
    })
    artwork.save(ASSET,format="PNG",optimize=True)
    entry["sha256_local"]=hashlib.sha256(ASSET.read_bytes()).hexdigest()
    MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n","utf-8")
    PAGE.write_text(before,"utf-8")
    LOGO_SCRIPT.write_text(script,"utf-8")
    print(json.dumps({"team":"Michigan State","complete_artwork":True,
                      "source_dimensions":list(source.size),"source_bbox":source_bbox,
                      "asset_geometry":geometry,"png_bytes":ASSET.stat().st_size,
                      "preview_refs":2,"production_refs":1},indent=2))

if __name__=="__main__":
    main()

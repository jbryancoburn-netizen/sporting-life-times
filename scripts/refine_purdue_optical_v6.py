#!/usr/bin/env python3
"""Fill Purdue Pete's circle more effectively without distorting historical art.

A running/diagonal silhouette has a different *geometric circle center* from
its weighted visual center. Earlier passes shrank Pete using the visual center
as the only anchor, leaving unnecessary white space. Search small source-image
translations and enlarge the exact original until the silhouette fills the
circular opening, retaining visual balance and a measured gap before the ring.
Only PNG pixels change; never add per-team CSS/JS offsets.
"""
from __future__ import annotations

import hashlib
from io import BytesIO
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "assets/cbb-big-ten-1980s/centered/purdue.png"
PAGE = ROOT / "cbb-big-ten-1980s-preview.html"
QA = ROOT / "reports/purdue-pete-optical-size-v6.json"
INPUT_SHA = "d2bc7123d4634d1e5f186f63daf3d8de9a021839"
OLD_VERSION = "20261114-pete-balanced-v5"
NEW_VERSION = "20261114-pete-optical-v6"
DIM = 512
MID = DIM/2
# The already-audited 238px circle is a conservative inner-ring proxy.
# Preserve >=8px on the source canvas, equivalent to ~1.5px on mobile.
RADIUS_LIMIT = 230.0
# The center of visual ink may shift modestly to better fit a diagonal
# figure, but must remain within 28px on a 512px source (<5px on mobile).
MAX_WEIGHTED_CENTER_OFFSET = 28.0

def git_blob_sha(data):
    return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()

def foreground(im):
    p=im.convert("RGBA").load()
    points=[]
    for y in range(DIM):
        for x in range(DIM):
            r,g,b,a=p[x,y]
            if a<100 or (r>=241 and g>=241 and b>=241):
                continue
            points.append((x,y,max(1,255-min(r,g,b))))
    if len(points)<15000:
        raise AssertionError("Archival mascot ink missing")
    return points

def convex_hull(points):
    coords=sorted({(x,y) for x,y,w in points})
    def cross(o,a,b):
        return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[]
    for pt in coords:
        while len(lower)>1 and cross(lower[-2],lower[-1],pt)<=0:
            lower.pop()
        lower.append(pt)
    upper=[]
    for pt in reversed(coords):
        while len(upper)>1 and cross(upper[-2],upper[-1],pt)<=0:
            upper.pop()
        upper.append(pt)
    return lower[:-1]+upper[:-1]

def describe(im):
    pts=foreground(im)
    mass=sum(w for _,_,w in pts)
    cx=sum(x*w for x,y,w in pts)/mass
    cy=sum(y*w for x,y,w in pts)/mass
    maxrad=max(math.hypot(x-MID,y-MID) for x,y,w in pts)
    return {
        "ink_pixels":len(pts),
        "weighted_center":[round(cx,2),round(cy,2)],
        "visual_center_offset_px":round(math.hypot(cx-MID,cy-MID),2),
        "radial_ink_max_px":round(maxrad,2),
        "ring_margin_px":round(238-maxrad,2),
        "long_side_px":max(max(x for x,y,w in pts)-min(x for x,y,w in pts)+1,
                           max(y for x,y,w in pts)-min(y for x,y,w in pts)+1)
    }

def fit_art(src,points):
    old=describe(src)
    hull=convex_hull(points)
    mass=sum(w for x,y,w in points)
    c_x=sum(x*w for x,y,w in points)/mass
    c_y=sum(y*w for x,y,w in points)/mass
    src_bounds=(min(x for x,y,w in points),min(y for x,y,w in points),
                max(x for x,y,w in points)+1,max(y for x,y,w in points)+1)
    x0,y0,x1,y1=src_bounds
    left=max(0,x0-3); top=max(0,y0-3)
    right=min(DIM,x1+3); bottom=min(DIM,y1+3)
    clipped=src.crop((left,top,right,bottom))
    # Search the *best feasible* circle anchor: among options with adequate
    # circular clearance, prefer the smallest translation of visible ink.
    # Test substantial increases first; if geometry cannot safely support
    # that scale, fall back to the next well-separated visible size.
    variants=[]
    for longest in (380,375,370,365,360,355,350,345):
        factor=longest/old["long_side_px"]
        source_radius_limit=(RADIUS_LIMIT-1.3)/factor
        best=None
        for dx in range(-31,32):
            for dy in range(-31,32):
                if math.hypot(dx,dy)*factor > MAX_WEIGHTED_CENTER_OFFSET:
                    continue
                px,py=c_x+dx,c_y+dy
                radius=max(math.hypot(x-px,y-py) for x,y in hull)
                if radius>source_radius_limit:
                    continue
                candidate=(dx*dx+dy*dy,radius,px,py,dx,dy)
                if best is None or candidate[:2]<best[:2]:
                    best=candidate
        variants.append({"long_target":longest,"feasible":bool(best),
                         "best_center_offset_src":[best[4],best[5]] if best else None})
        if best is None:
            continue
        anchor_x,anchor_y=best[2],best[3]
        nw,nh=round(clipped.width*factor),round(clipped.height*factor)
        resized=clipped.resize((nw,nh),Image.Resampling.LANCZOS)
        xpos=round(MID-(anchor_x-left)*nw/clipped.width)
        ypos=round(MID-(anchor_y-top)*nh/clipped.height)
        if min(xpos,ypos)<2 or xpos+nw>DIM-2 or ypos+nh>DIM-2:
            continue
        result=Image.new("RGBA",(DIM,DIM),(255,255,255,255))
        result.alpha_composite(resized,(xpos,ypos))
        after=describe(result)
        if (after["radial_ink_max_px"]<=RADIUS_LIMIT
            and after["visual_center_offset_px"]<=MAX_WEIGHTED_CENTER_OFFSET
            and after["ring_margin_px"]>=8.0
            and after["long_side_px"]>=350):
            return result,{"chosen_target":longest,"scale":round(factor,3),
                           "anchor_offset_from_visual_center_src":[best[4],best[5]],
                           "circle_hull_points":len(hull),"candidate_search":variants}
    raise AssertionError("No safe enlargement found. Do not ship another undersized logo: "+str(variants))

def main():
    raw=FILE.read_bytes()
    if git_blob_sha(raw)!=INPUT_SHA:
        raise AssertionError("Original Purdue artwork changed; refusing unreviewed rescale")
    with Image.open(BytesIO(raw)) as opened:
        source=opened.convert("RGBA")
    if source.size!=(DIM,DIM):
        raise AssertionError("Expected a 512px source")
    before=describe(source)
    result,method=fit_art(source,foreground(source))
    after=describe(result)
    if after["long_side_px"]<350 or after["long_side_px"]<=before["long_side_px"]*1.07:
        raise AssertionError("Purdue artwork did not grow appreciably")
    if after["ring_margin_px"]<8 or after["radial_ink_max_px"]>RADIUS_LIMIT:
        raise AssertionError("Purdue Pete crowds the existing circular ring")
    html=PAGE.read_text(encoding="utf-8")
    old=f"assets/cbb-big-ten-1980s/centered/purdue.png?v={OLD_VERSION}"
    new=f"assets/cbb-big-ten-1980s/centered/purdue.png?v={NEW_VERSION}"
    if html.count(old)!=2:
        raise AssertionError("Expected two exactly matching preview references")
    html=html.replace(old,new)
    if html.count('<img src="assets/cbb-big-ten-1980s/centered/')!=14:
        raise AssertionError("Other Big Ten marks must remain untouched")
    if '--slt-ink-' in html or 'cbb-big-ten-optical-center' in html:
        raise AssertionError("Disallowed old positioning script")
    result.save(FILE,format="PNG",optimize=True)
    PAGE.write_text(html,encoding="utf-8")
    QA.parent.mkdir(exist_ok=True)
    QA.write_text(json.dumps({
        "asset":"original vintage running Purdue Pete",
        "scope":"Big Ten preview PNG ONLY; no ring or script changes",
        "before":before,"after":after,"method":method,
        "all_preview_images_retained":14
    },indent=2)+"\n")
    print(QA.read_text())
    print("PASS: Purdue Pete visibly larger with source-pixel circular clearance; no CSS offsets")
if __name__=="__main__":
    main()

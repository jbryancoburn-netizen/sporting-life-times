#!/usr/bin/env python3
"""Build an auditable candidate palette for DII from matched NCAA SVG school logos.

The sampled colors describe LOGO ARTWORK, not certified institutional palettes.
This file only writes an independent evidence artifact; it does not change the
newspaper's school colors without a separate review/publication step.
"""
import collections
import concurrent.futures
import datetime
import json
import math
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/"
HEX=re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])")
FILL=re.compile(r"(?:fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,6})\b",re.I)
CSS_CLASS=re.compile(r"\.([a-zA-Z][\w-]*)\s*\{([^}]*)\}")

def canonical(v):
    v=str(v).strip().lower()
    if not HEX.fullmatch(v):return None
    if len(v)==4:v="#"+''.join(c*2 for c in v[1:])
    rgb=[int(v[i:i+2],16) for i in (1,3,5)]
    if min(rgb)>239:return None
    return v

def distance(a,b):
    return math.sqrt(sum((int(a[i:i+2],16)-int(b[i:i+2],16))**2 for i in (1,3,5)))

def from_svg(svg):
    """Extract literal vector fills with CSS class support; reject single-color SVGs."""
    if len(svg)>450000:return {"error":"SVG oversized"}
    if "<!DOCTYPE" in svg.upper() or "<!ENTITY" in svg.upper():
        return {"error":"Unsupported SVG declarations"}
    try:root=ET.fromstring(svg)
    except ET.ParseError:return {"error":"SVG parse error"}
    if root.tag.split("}")[-1]!="svg":return {"error":"Not SVG"}
    css={}
    for el in root.iter():
        if el.tag.split("}")[-1]!="style":continue
        for cls,body in CSS_CLASS.findall(el.text or ""):
            m=FILL.search(body)
            if m:css[cls]=canonical(m.group(1))
    weights=collections.Counter()
    shape_count=0
    for el in root.iter():
        if el.tag.split("}")[-1] not in ("path","rect","circle","ellipse","polygon","polyline","line","text","use"):continue
        shape_count+=1
        paints=[]
        for fld in ("fill","stroke"):
            col=canonical(el.get(fld,""))
            if col:paints.append(col)
        for m in FILL.finditer(el.get("style","")):
            col=canonical(m.group(1))
            if col:paints.append(col)
        for cls in el.get("class","").split():
            if css.get(cls):paints.append(css[cls])
        # Only count colors on a drawn element, not decorative SVG metadata.
        if paints:
            weight=max(1,min(35,len(el.get("d",""))//70+1))
            for col in set(paints):weights[col]+=weight
    ranked=weights.most_common(12)
    if not ranked:return {"error":"No explicit vector paint","shapes":shape_count}
    primary=ranked[0][0]
    second=next((c for c,w in ranked[1:] if distance(primary,c)>=55 and w>=2),None)
    if not second:return {"error":"Insufficient distinct SVG artwork colors","shapes":shape_count,"top_colors":ranked[:4]}
    return {"primary":primary,"secondary":second,
            "method":"literal NCAA school SVG vector paint; not institutional brand codes",
            "shapes":shape_count,"top_colors":ranked[:6]}

def get(slug):
    if not re.fullmatch(r"[a-z0-9-]{2,70}",slug):
        return slug,{"error":"Invalid school slug"}
    url=BASE+slug+".svg"
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-D2LogoPaletteAudit/1.0","Accept":"image/svg+xml"})
        with urllib.request.urlopen(req,timeout=14) as response:
            if int(response.headers.get("content-length") or 0)>450000:
                return slug,{"error":"Oversized server response","source_url":url}
            blob=response.read(450001)
        if len(blob)>450000:raise ValueError("SVG too large")
        item=from_svg(blob.decode("utf-8"))
    except Exception as exc:
        item={"error":str(exc)[:150]}
    return slug,{"source_url":url,**item}

def main():
    teams=[]
    for gender in ("men","women"):
        obj=json.loads((ROOT/"data"/f"d2-{gender}-2026-27.json").read_text())
        teams.extend(t for t in obj["teams"] if t.get("slug"))
    slugs=sorted({t["slug"] for t in teams})
    result={"as_of":datetime.datetime.now(datetime.timezone.utc).isoformat(),
      "kind":"candidates only; not published verified team palettes",
      "source":"NCAA school SVG files, not guaranteed university brand guidelines",
      "unique_slug_count":len(slugs),"entries":{}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for school,palette in pool.map(get,slugs):
            result["entries"][school]=palette
    result["candidate_count"]=sum("primary" in v and "secondary" in v for v in result["entries"].values())
    out=ROOT/"data"/"d2-ncaa-logo-artwork-palette-audit.json"
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    print("NCAA vector logo candidates",result["candidate_count"],"of",len(slugs))
    print("Not altering published school-color data until identity and color review.")

if __name__=="__main__":main()

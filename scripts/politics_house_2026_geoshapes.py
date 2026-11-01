#!/usr/bin/env python3
"""Generate navigable congressional district boundaries from official Census TIGER.

Normal states: 2026 120th Congressional District TIGER/Line shapefile.
Missouri: 2025 119th Congressional District TIGER, which is the map
actually in force for 2026 after the September 23 court decision.
IMPORTANT: Census TIGER2026 Missouri files are WRONG for November 2026.
These are geographic shapes ONLY, not population or vote estimates.
"""
from __future__ import annotations
from datetime import datetime,timezone
import hashlib
import io
import json
from pathlib import Path
import re
import time
import urllib.request
import zipfile
import shapefile
from shapely.geometry import shape as read_shape,mapping,Polygon,MultiPolygon,GeometryCollection
from shapely.validation import make_valid

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"politics-house-geography"
INDEX=ROOT/"politics-house-geography-index.json"
ATLAS=ROOT/"politics-house-atlas.json"
URL_PREFIX="https://www2.census.gov/geo/tiger"
MAX_BYTES=7_500_000
FIPS={
"AL":"01","AK":"02","AZ":"04","AR":"05","CA":"06","CO":"08","CT":"09","DE":"10",
"FL":"12","GA":"13","HI":"15","ID":"16","IL":"17","IN":"18","IA":"19","KS":"20",
"KY":"21","LA":"22","ME":"23","MD":"24","MA":"25","MI":"26","MN":"27","MS":"28",
"MO":"29","MT":"30","NE":"31","NV":"32","NH":"33","NJ":"34","NM":"35","NY":"36",
"NC":"37","ND":"38","OH":"39","OK":"40","OR":"41","PA":"42","RI":"44","SC":"45",
"SD":"46","TN":"47","TX":"48","UT":"49","VT":"50","VA":"51","WA":"53","WV":"54",
"WI":"55","WY":"56"}
SOURCE_HASHES={
"FL":"7d22cba78f6553e192fca414e78f96c07d2a38e96cdd6450e39b9c3ceed9a2f4",
"WY":"3d8a9a6bf6346be86f79cc4348b5d464b50f785a71495a66c618965da1d32e8c",
"MO":"1e289687c4dd7ec9be62823d63124036605ea93ffe27286aaa9d2818b1ba4090",
}
SIMPLIFY_DEGREES=0.008

def source_for(state):
    if state not in FIPS:raise ValueError("Not a canonical state")
    if state=="MO":
        return URL_PREFIX+"/TIGER2025/CD/tl_2025_29_cd119.zip","CD119FP","119th_2025_predecessor_valid_2026"
    return URL_PREFIX+"/TIGER2026/CD/tl_2026_"+FIPS[state]+"_cd120.zip","CD120FP","120th_2026"

def fetch(url):
    if not url.startswith(URL_PREFIX+"/TIGER20") or not url.endswith(".zip"):
        raise ValueError("Only approved Census shapefile URLs allowed")
    req=urllib.request.Request(url,headers={
      "User-Agent":"Political-Life-and-Times/1.0 (US Census public 120th congressional maps)",
      "Accept":"application/zip, application/octet-stream, */*"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=65) as response:
                if response.status!=200:raise ValueError("Census source response non-200")
                data=response.read(MAX_BYTES+1)
            if not 10000<=len(data)<=MAX_BYTES or data[:2]!=b"PK":
                raise ValueError("Missing or oversized original Census district file")
            return data
        except (TimeoutError,OSError) as exc:
            if attempt==2:raise
            print("Census source retry",url,str(exc)[:140],flush=True)
            time.sleep(3+attempt*4)
    raise AssertionError("unreachable")

def _polygons(geom):
    if geom.is_empty:raise ValueError("Empty Census district geometry")
    if not geom.is_valid:geom=make_valid(geom)
    if isinstance(geom,Polygon): return [geom]
    if isinstance(geom,MultiPolygon):return list(geom.geoms)
    if isinstance(geom,GeometryCollection):
        polys=[]
        for part in geom.geoms:
            if isinstance(part,Polygon):polys.append(part)
            elif isinstance(part,MultiPolygon):polys.extend(part.geoms)
        if polys:return polys
    raise ValueError("Unexpected Census district shape type "+geom.geom_type)

def _rounded_rings(geom):
    parts=[]
    for poly in _polygons(geom):
        simple=poly.simplify(SIMPLIFY_DEGREES,preserve_topology=True)
        for item in _polygons(simple):
            rings=[]
            for line in [item.exterior,*item.interiors]:
                # Keep a closed outline, with at most 5 decimal places.
                points=[[round(x,5),round(y,5)] for x,y,*_ in line.coords]
                if len(points)>=4:rings.append(points)
            if rings:parts.append(rings)
    if not parts:raise ValueError("No drawable polygon rings")
    return parts

def read_state(blob,state,column,expected_ids):
    digest=hashlib.sha256(blob).hexdigest()
    expected_hash=SOURCE_HASHES.get(state)
    if expected_hash and digest!=expected_hash:
        raise ValueError("Previously reviewed official Census geometry changed for "+state)
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        members=z.namelist()
        shapes=[name for name in members if name.endswith(".shp")]
        if len(shapes)!=1:raise ValueError("Ambiguous census shapefile archive")
        base=shapes[0][:-4]
        sf=shapefile.Reader(shp=io.BytesIO(z.read(base+".shp")),
                            dbf=io.BytesIO(z.read(base+".dbf")),
                            shx=io.BytesIO(z.read(base+".shx")))
        fields={p[0] for p in sf.fields[1:]}
        if column not in fields or "STATEFP" not in fields or "GEOID" not in fields:
            raise ValueError("Missing Congressional District primary GEOIDs")
        districts=[]
        seen=set()
        for record in sf.iterShapeRecords():
            p=record.record.as_dict()
            cd=p[column]
            if not isinstance(cd,str) or not re.fullmatch(r"\d{2}",cd):
                raise ValueError("Noncanonical Census congressional district ID")
            rid=state+"-"+cd
            if rid in seen or rid not in expected_ids:
                raise ValueError("Unexpected/duplicate CD geometry "+rid)
            if p["STATEFP"]!=FIPS[state] or p["GEOID"]!=FIPS[state]+cd:
                raise ValueError("State/census GEOID mismatch "+rid)
            geo=read_shape(record.shape.__geo_interface__)
            polygons=_rounded_rings(geo)
            districts.append({"id":rid,"polygons":polygons})
            seen.add(rid)
    if seen!=expected_ids:
        raise ValueError("Incomplete state geographic coverage for "+state+
                        ", missing="+str(sorted(expected_ids-seen)))
    return {"state":state,"source_sha256":digest,"districts":sorted(districts,key=lambda d:d["id"]),
            "simplification_degrees":SIMPLIFY_DEGREES}

def build(fetcher=fetch):
    atlas=json.loads(ATLAS.read_text(encoding="utf-8"))
    if atlas.get("district_count")!=435 or atlas.get("forecast_eligible") is not False:
        raise ValueError("Official 435 House district inventory not certified")
    expected={s["code"]:{d["id"] for d in atlas["districts"] if d["state"]==s["code"]} for s in atlas["states"]}
    if set(expected)!=set(FIPS):
        raise ValueError("Every voting state required for real-boundary map")
    OUT.mkdir(exist_ok=True)
    state_index=[]
    generated=0
    for state in sorted(FIPS):
        url,column,vintage=source_for(state)
        blob=fetcher(url)
        data=read_state(blob,state,column,expected[state])
        if state=="MO" and vintage!="119th_2025_predecessor_valid_2026":
            raise ValueError("Unsafe Missouri 2026 congressional map")
        d={
           "status":"CENSUS_CONGRESSIONAL_BOUNDARIES_ELECTION_2026",
           "state":state,"vintage":vintage,"district_count":len(data["districts"]),
           "source_url":url,"source_sha256":data["source_sha256"],
           "coordinate_system":"EPSG:4326_longitude_latitude",
           "shape_simplification_degrees":SIMPLIFY_DEGREES,
           "geometry_are_not_votes_or_populations":True,
           "forecast_eligible":False,"districts":data["districts"],
           "warning":"Original Census TIGER shapes, simplified solely for interactive cartographic visualization. Missouri uses the 119th Congress boundaries because the original Census 120th Congress Missouri file is stale after September 2026 court action. Colors come from the separately sourced district atlas; no votes inferred from polygon area."
        }
        dest=OUT/(state+".json")
        dest.write_text(json.dumps(d,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
        size=dest.stat().st_size
        if size>2_200_000:raise ValueError("Unexpected oversized geographic state JSON "+state)
        state_index.append({"state":state,"district_count":len(data["districts"]),"source_url":url,
           "sha256":data["source_sha256"],"vintage":vintage,
           "bytes":size,"path":"politics-house-geography/"+state+".json"})
        generated+=len(data["districts"])
        print("CENSUS_STATE",state,"districts",len(data["districts"]),"json_bytes",size,flush=True)
    if generated!=435 or len(state_index)!=50:
        raise ValueError("Census shapes fail 50 state/435 federal voting district conservation")
    summary={
        "status":"ALL_435_HOUSE_BOUNDARY_SHAPES_VERIFIED",
        "built_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "election_year":2026,"district_count":435,"state_count":50,
        "source_authority":"U.S. Census TIGER/Line 2026 120th Congress; Missouri 2025 119th map used in 2026",
        "missouri_map_exception_applied":True,
        "2026_vote_result_or_probability_inferred":False,
        "states":state_index}
    INDEX.write_text(json.dumps(summary,separators=(",",":"))+"\n",encoding="utf-8")
    return summary

def main():
    o=build()
    print("Census 2026 House geographic maps validated:",o["state_count"],"states,",o["district_count"],"districts; corrected Missouri")
if __name__=="__main__":main()

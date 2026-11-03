#!/usr/bin/env python3
"""Build source-backed 2026 community geography for all 435 US House districts.

2026 Census Gazetteer representative place points are overlaid on verified
Census 2026 congressional polygons already in politics-geometry/.
Population rankings come ONLY from official 2020 decennial place totals.
A place whose reference point lies inside a district is NOT a claim that
the entire municipality is contained in the district.
No API keys, paid sources, third-party mapping APIs, or invented town names.
"""
from __future__ import annotations
import collections
import concurrent.futures
import csv
import datetime as dt
import io
import json
import math
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "politics-district-communities.json"
GAZ = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip"
POP_API = "https://api.census.gov/data/2020/dec/pl"
USER_AGENT = "SportingLifeTimes/1.0 (source-attributed Census geography research)"
TIMEOUT = 35
TOP = 14
FIPS = {
 "AL":"01","AK":"02","AZ":"04","AR":"05","CA":"06","CO":"08","CT":"09",
 "DE":"10","FL":"12","GA":"13","HI":"15","ID":"16","IL":"17","IN":"18",
 "IA":"19","KS":"20","KY":"21","LA":"22","ME":"23","MD":"24","MA":"25",
 "MI":"26","MN":"27","MS":"28","MO":"29","MT":"30","NE":"31","NV":"32",
 "NH":"33","NJ":"34","NM":"35","NY":"36","NC":"37","ND":"38","OH":"39",
 "OK":"40","OR":"41","PA":"42","RI":"44","SC":"45","SD":"46","TN":"47",
 "TX":"48","UT":"49","VT":"50","VA":"51","WA":"53","WV":"54","WI":"55",
 "WY":"56"
}

def get_bytes(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/json,text/plain,application/zip,*/*"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
                payload = res.read(12_000_000)
                if not payload:
                    raise ValueError("Empty Census response")
                return payload
        except (TimeoutError, OSError, urllib.error.URLError, ValueError):
            if attempt+1 == tries: raise
            time.sleep((attempt+1)*2)

def read_places():
    body=get_bytes(GAZ)
    with zipfile.ZipFile(io.BytesIO(body)) as pack:
        names=[n for n in pack.namelist() if n.lower().endswith(".txt")]
        if not names: raise ValueError("2026 Gazetteer ZIP has no text file")
        raw=pack.read(names[0]).decode("utf-8-sig").strip()
    sep="|" if "|" in raw.splitlines()[0] else "\t"
    rows=csv.DictReader(io.StringIO(raw),delimiter=sep)
    places=collections.defaultdict(list)
    for row in rows:
        row={k.strip().upper():str(v).strip() for k,v in row.items() if k}
        geoid=row.get("GEOID","")
        lat=row.get("INTPTLAT","")
        lon=row.get("INTPTLONG","")
        if len(geoid)<7 or not lat or not lon: continue
        fips=geoid[:2]
        if fips not in set(FIPS.values()): continue
        name=row.get("NAME","").strip()
        if not name: continue
        try: point=(float(lon),float(lat))
        except ValueError: continue
        if not all(math.isfinite(t) for t in point): continue
        place_id=geoid[2:7]
        places[fips].append({
          "geoid":geoid[:7],"place_code":place_id,
          "name":name,"lon":point[0],"lat":point[1],
          "area_sqmi":round(float(row.get("ALAND_SQMI") or 0),2)
        })
    if sum(map(len,places.values()))<20000: raise ValueError("Not enough official place entries")
    return places

def population_for_state(item):
    code,fips=item
    q=urllib.parse.urlencode({"get":"NAME,P1_001N","for":"place:*","in":"state:"+fips})
    raw=get_bytes(POP_API+"?"+q)
    rows=json.loads(raw)
    header=rows[0]
    return fips,{r[header.index("place")]:int(r[header.index("P1_001N")]) for r in rows[1:] if r[header.index("P1_001N")].isdigit()}

def normalize_lon(lon,state):
    return lon-360 if state=="AK" and lon>0 else lon

def inside_ring(x,y,ring):
    crossing=False
    prev=ring[-1]
    for point in ring:
        x1,y1=prev[0],prev[1];x2,y2=point[0],point[1]
        if (y1>y)!=(y2>y):
            at=x1+(y-y1)*(x2-x1)/(y2-y1)
            if x<at: crossing=not crossing
        prev=point
    return crossing

def inside_polygon(x,y,polygon,state):
    rings=[]
    for ring in polygon:
        rings.append([(normalize_lon(float(p[0]),state),float(p[1])) for p in ring])
    if not rings:return False
    if not inside_ring(x,y,rings[0]):return False
    return not any(inside_ring(x,y,hole) for hole in rings[1:])

def bounds(polys):
    pts=(pt for poly in polys for ring in poly[:1] for pt in ring)
    xy=list(pts)
    if not xy:return None
    return min(p[0] for p in xy),min(p[1] for p in xy),max(p[0] for p in xy),max(p[1] for p in xy)

def district_polygons(feature,state):
    g=feature.get("geometry") or {}
    shape=g.get("coordinates") or []
    raw=[shape] if g.get("type")=="Polygon" else shape if g.get("type")=="MultiPolygon" else []
    return [[[(normalize_lon(float(p[0]),state),float(p[1])) for p in ring] for ring in poly] for poly in raw]

def main():
    atlas=json.loads((ROOT/"politics-house-atlas.json").read_text(encoding="utf-8"))
    acs=json.loads((ROOT/"politics-census-inputs.json").read_text(encoding="utf-8"))
    acs_by_id={r["id"]:r for r in acs["districts"]}
    places=read_places()
    print("2026 Census Gazetteer places:",sum(map(len,places.values())),flush=True)
    populations={}
    failed=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(population_for_state,item):item for item in FIPS.items()}
        for f in concurrent.futures.as_completed(futures):
            try:
                k,v=f.result();populations[k]=v
            except Exception as exc:
                failed.append((futures[f][0],type(exc).__name__))
    # Reject an incomplete population ingest rather than misrank places silently.
    if failed:raise RuntimeError("Census population requests failed: "+repr(failed))
    records={}
    for state,fips in FIPS.items():
        file=ROOT/"politics-geometry"/(state+".geojson")
        geo=json.loads(file.read_text(encoding="utf-8"))
        field=geo["meta"]["field"]
        indexed=collections.defaultdict(list)
        for feat in geo["features"]:
            v=str(feat["properties"][field]).zfill(2)
            district_id=state+"-"+v
            polygons=district_polygons(feat,state)
            boxes=[bounds([poly]) for poly in polygons]
            indexed[district_id]=[(poly,box) for poly,box in zip(polygons,boxes) if box]
        for item in places[fips]:
            x=normalize_lon(item["lon"],state)
            y=item["lat"]
            for district_id,shapes in indexed.items():
                for poly,box in shapes:
                    if box[0]<=x<=box[2] and box[1]<=y<=box[3] and inside_ring(x,y,poly[0]) and not any(inside_ring(x,y,h) for h in poly[1:]):
                        out=records.setdefault(district_id,[])
                        out.append({
                          "name":item["name"],
                          "lat":round(item["lat"],6),"lon":round(item["lon"],6),
                          "geoid":item["geoid"],"population_2020":populations[fips].get(item["place_code"])
                        })
                        break
        print(state, "mapped",sum(len(records.get(x,[])) for x in indexed), "place points into",len(indexed),"districts",flush=True)
    result={}
    for r in atlas["districts"]:
        id=r["id"]
        raw=records.get(id,[])
        raw.sort(key=lambda x:(-(x["population_2020"] if x["population_2020"] is not None else -1),x["name"]))
        # Prefer names of larger settlements, but never claim whole city falls in district.
        best=raw[:TOP]
        a=acs_by_id.get(id) or {}
        metrics={}
        for f in ("population_2020_2024_acs_est","median_household_income_est","bachelors_plus_age25_pct_est"):
            if a.get(f) is not None: metrics[f]=a[f]
        result[id]={
          "state":r["state"],"boundary_vintage":("119th" if r["state"]=="MO" else "120th"),
          "boundaries_changed_2026":bool(r.get("2026_boundaries_revised")),
          "communities":best,"verified_place_point_count":len(raw),
          "census_2020_2024_acs_on_old_boundaries":metrics,
          "historical_acs_caution":bool(r.get("2026_boundaries_revised")),
          "geographic_rule":"Each community's official 2026 Census representative point falls within the displayed congressional polygon. Municipal limits may cross district boundaries."
        }
    if len(result)!=435:raise AssertionError("Not all 435 districts present")
    total=sum(bool(x["communities"]) for x in result.values())
    obj={
      "schema_version":1,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "census_gazetteer_url":GAZ,"population_url":POP_API,
      "geometry_source":"politics-geometry/[STATE].geojson (Census TIGERweb 2026; MO 119th fallback)",
      "method":"2026 Gazetteer place reference points within official congressional polygons; 2020 Decennial place population for sorting only",
      "district_count":len(result),"districts_with_named_places":total,
      "districts_without_named_places":sorted(id for id,x in result.items() if not x["communities"]),
      "districts":result
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Published source-backed communities for",total,"of",len(result),"districts. Remaining:",len(result)-total,flush=True)

if __name__=="__main__":main()

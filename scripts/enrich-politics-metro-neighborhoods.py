#!/usr/bin/env python3
"""Enrich dense NYC and Philadelphia congressional seats with real named neighborhoods.
Spatial sources: NYC Department of City Planning 2020 NTAs; City of Philadelphia
open neighborhood boundaries; Census congressional district polygon 2026.
A neighborhood's interior point lying in a district does not mean every block
of that neighborhood is inside that district. No paid APIs or fake local facts.
"""
from __future__ import annotations
import datetime as dt
import json
import math
import pathlib
import urllib.parse
import urllib.request
ROOT=pathlib.Path(__file__).resolve().parent.parent
DATA=ROOT/"data/politics-district-communities.json"
NYC="https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Neighborhood_Tabulation_Areas_2020/FeatureServer/0"
PHL="https://services9.arcgis.com/Nzt3APH7h0GUTCYF/ArcGIS/rest/services/Philly_Map_Exercise_3_2023_WFL1/FeatureServer/11"

def get_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0 (civic geography, free open source)"})
    with urllib.request.urlopen(req,timeout=50) as response:
        return json.load(response)

def source_features(base,field,limit=500):
    all_features=[]
    for offset in range(0,1000,200):
        query=urllib.parse.urlencode({
            "where":"1=1","outFields":"*","returnGeometry":"true",
            "outSR":"4326","geometryPrecision":"5","f":"geojson",
            "resultOffset":str(offset),"resultRecordCount":"200"
        })
        obj=get_json(base+"/query?"+query)
        if not isinstance(obj.get("features"),list):
            raise ValueError("No GeoJSON features from "+base+"; response="+repr(obj)[:350])
        batch=obj["features"]
        all_features.extend(batch)
        if len(batch)<200: break
    if not all_features:raise ValueError("Empty city neighborhood source: "+base)
    print("Fetched",len(all_features),"neighborhood polygon features from",base,flush=True)
    return all_features

def rings(geom):
    if not geom:return []
    coords=geom.get("coordinates") or []
    return [coords] if geom.get("type")=="Polygon" else coords if geom.get("type")=="MultiPolygon" else []

def inside_ring(x,y,ring):
    inside=False
    prev=ring[-1]
    for p in ring:
        a,b=prev[0],prev[1];c,d=p[0],p[1]
        if (b>y)!=(d>y) and x<a+(y-b)*(c-a)/(d-b):
            inside=not inside
        prev=p
    return inside

def inside(x,y,geom):
    for poly in rings(geom):
        if poly and inside_ring(x,y,poly[0]) and not any(inside_ring(x,y,h) for h in poly[1:]):
            return True
    return False

def point_of(geom):
    polygons=rings(geom)
    if not polygons:return None
    # Look for a stable interior point in the biggest polygon.
    def extent(poly):
        xs=[p[0] for p in poly[0]];ys=[p[1] for p in poly[0]]
        return min(xs),min(ys),max(xs),max(ys)
    polygons=sorted(polygons,key=lambda p:(extent(p)[2]-extent(p)[0])*(extent(p)[3]-extent(p)[1]),reverse=True)
    for poly in polygons:
        a,b,c,d=extent(poly)
        probes=[((a+c)/2,(b+d)/2)]
        for n in (9,21):
            for i in range(n):
                for j in range(n):
                    probes.append((a+(c-a)*(i+.5)/n,b+(d-b)*(j+.5)/n))
        for x,y in probes:
            if inside(x,y,{"type":"Polygon","coordinates":poly}):
                return round(x,6),round(y,6)
    return None

def main():
    doc=json.loads(DATA.read_text(encoding="utf-8"))
    assert len(doc["districts"])==435
    polygons={}
    for st in ("NY","PA"):
        geo=json.loads((ROOT/"politics-geometry"/(st+".geojson")).read_text(encoding="utf-8"))
        field=geo["meta"]["field"]
        for feat in geo["features"]:
            did=st+"-"+str(feat["properties"][field]).zfill(2)
            polygons[did]=feat["geometry"]
    samples=[
        (NYC,"NYC DCP 2020 neighborhood tabulation area","NTAName","https://data.cityofnewyork.us/City-Government/2020-Neighborhood-Tabulation-Areas-NTAs-/9nt8-h7nd","NY"),
        (PHL,"Philadelphia neighborhood reference area","NAME","https://catalog.data.gov/dataset/philadelphia-neighborhoods","PA")
    ]
    for url,label,field,source,st in samples:
        features=source_features(url,field)
        for feat in features:
            props=feat.get("properties") or {}
            name=str(props.get(field) or props.get("LISTNAME") or "").strip()
            if not name:continue
            if st=="NY" and props.get("NTAType") not in ("0",0,None,""):
                continue  # exclude parks, airports, cemeteries when classified separately
            point=point_of(feat.get("geometry"))
            if point is None:continue
            x,y=point
            for did,geometry in polygons.items():
                if not did.startswith(st+"-"):continue
                if inside(x,y,geometry):
                    entry={
                        "name":name,"lon":x,"lat":y,"kind":label,
                        "source_url":source,"geographic_note":"Reference point in both the named neighborhood geography and congressional district; either polygon may cross the other."
                    }
                    doc["districts"][did].setdefault("neighborhoods",[]).append(entry)
                    break
    for r in doc["districts"].values():
        if r.get("neighborhoods"):
            r["neighborhoods"]=sorted(r["neighborhoods"],key=lambda x:x["name"])[:18]
    doc["districts_with_community_or_neighborhood"]=sum(
        bool(x.get("communities") or x.get("neighborhoods")) for x in doc["districts"].values()
    )
    doc["districts_still_needing_named_neighborhoods"]=sorted(
        k for k,x in doc["districts"].items() if not(x.get("communities") or x.get("neighborhoods"))
    )
    doc["neighborhood_sources"]=[x[3] for x in samples]
    doc["neighborhood_method"]="Reference points within both municipality's named neighborhood polygons and official district polygons; NOT whole-neighborhood containment."
    doc["generated_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    print("Districts with named places or neighborhoods:",doc["districts_with_community_or_neighborhood"],"/ 435",flush=True)
    print("Still missing",doc["districts_still_needing_named_neighborhoods"],flush=True)
    DATA.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")

if __name__=="__main__":main()

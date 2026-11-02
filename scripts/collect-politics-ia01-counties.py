#!/usr/bin/env python3
"""Cache exactly IA-01's 20 official Iowa county GIS polygons.
Source: State of Iowa Iowa County Boundaries FeatureServer.
Never synthesize, translate or approximate missing polygons.
Requires Python 3 standard library; no paid geocoding or data services.
"""
from __future__ import annotations
import datetime as dt
import json
import math
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
INPUT = ROOT / "politics-district-guide.json"
CONF = ROOT / "data" / "politics-ia01-geostory.json"
OUTPUT = ROOT / "data" / "politics-ia01-counties.geojson"
META = ROOT / "data" / "politics-ia01-geometry-meta.json"


def check_ring(ring):
    if not isinstance(ring, list) or len(ring) < 4:
        raise ValueError("Empty or too-small polygon ring")
    for pair in ring:
        if not isinstance(pair, list) or len(pair) < 2:
            raise ValueError("Bad point")
        lon, lat = pair[:2]
        if (not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lon, lat))
                or not (-94 < lon < -90 and 40 < lat < 43)):
            raise ValueError(f"Coordinate falls outside eastern/southern Iowa: {pair}")
    if ring[0][:2] != ring[-1][:2]:
        raise ValueError("Official polygon ring not closed")


def check_geometry(geometry):
    if geometry.get("type") == "Polygon":
        polygons = [geometry.get("coordinates")]
    elif geometry.get("type") == "MultiPolygon":
        polygons = geometry.get("coordinates")
    else:
        raise ValueError("Not an official area polygon")
    if not isinstance(polygons, list) or not polygons:
        raise ValueError("Missing polygon")
    for poly in polygons:
        if not isinstance(poly, list) or not poly:
            raise ValueError("Bad polygon")
        for ring in poly:
            check_ring(ring)


def main():
    guide = json.loads(INPUT.read_text(encoding="utf-8"))["districts"]["IA-01"]
    conf = json.loads(CONF.read_text(encoding="utf-8"))
    rows = guide["county_results_2024"]["rows"]
    expected = {x["county"].strip().lower() for x in rows}
    assert len(expected) == 20, "Incorrect number of statutory counties"
    assert sum(x["dem"] for x in rows) == 206156, "House D canvass does not reconcile"
    assert sum(x["rep"] for x in rows) == 206955, "House R canvass does not reconcile"
    valid = conf["county_geography"]
    # The Iowa service has not honored string IN name lookups reliably.
    # Query all 99 official counties and filter the 20 statutory names HERE.
    # No inference or new geography is introduced by the client-side filter.
    params = {
        "where": "1=1",
        "outFields": "name,stfips,cofips",
        "returnGeometry": "true",
        "outSR": "4326",
        "geometryPrecision": "4",
        "f": "geojson",
    }
    url = valid["endpoint"] + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": "SportingLifeTimes-Geography/1.0 (source attributed; free data)",
        "Accept": "application/geo+json,application/json",
    })
    with urllib.request.urlopen(req, timeout=50) as response:
        payload = response.read(3_000_001)
    if len(payload) > 3_000_000:
        raise ValueError("Unexpected county GIS response size")
    obj = json.loads(payload)
    print("Iowa state GIS: returned", len(obj.get("features", [])), "feature candidates")
    if obj.get("type") != "FeatureCollection":
        raise ValueError("State endpoint did not return GeoJSON")
    selected = []
    names = set()
    for f in obj.get("features", []):
        name = str(f.get("properties", {}).get("name", "")).strip()
        norm = name.lower().removesuffix(" county")
        if norm not in expected or norm in names:
            continue
        st = str(f["properties"].get("stfips", "19"))
        if st != "19":
            raise ValueError("Non-Iowa county")
        check_geometry(f.get("geometry", {}))
        names.add(norm)
        # Small normalized properties. All geometry is preserved as provided
        # by the government except the server's documented rounding.
        selected.append({"type": "Feature",
                         "properties": {"name": name, "stfips": "19"},
                         "geometry": f["geometry"]})
    if names != expected:
        raise ValueError(f"County mismatch: missing {sorted(expected-names)}; extra {sorted(names-expected)}")
    selected.sort(key=lambda f: f["properties"]["name"])
    collection = {"type": "FeatureCollection", "features": selected}
    output = json.dumps(collection, separators=(",", ":"), ensure_ascii=False) + "\n"
    meta = {
        "district": "IA-01",
        "source_url": valid["source_page"],
        "source_query": url,
        "district_county_law": valid["district_counties_source"],
        "boundary_data": "State of Iowa county GIS polygons, original 4326, precision 4 decimal places",
        "number_of_counties": len(selected),
        "last_checked_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "method": "Filtered and validated, never hand-drawn, 20 of 20 expected",
    }
    # Avoid unnecessary commits for idempotent source fetches.
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != output:
        OUTPUT.write_text(output, encoding="utf-8")
        META.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
        print(f"Verified {len(selected)} original Iowa district counties; saved {len(output)} bytes")
    else:
        print("No changes to original Iowa county geometry", len(selected))
    return 0


if __name__ == "__main__":
    sys.exit(main())

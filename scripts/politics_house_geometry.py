#!/usr/bin/env python3
"""Archive the official congressional district polygons for the November 2026 House atlas.

The maps describe geography only. They do not assign historical presidential votes
to changed congressional districts or generate forecasts.
Missouri MUST use the 119th congressional boundaries in the November 2026 election.
No output is published unless all 50 state geometries match the complete 435-seat atlas.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import json
import os
from pathlib import Path
import tempfile
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer"
STATE_FIPS = dict(zip(
    ("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO "
     "MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split(),
    ("01 02 04 05 06 08 09 10 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 "
     "30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56").split(),
))
assert len(STATE_FIPS) == 50


def api_request(state: str) -> tuple[str, dict]:
    """Fetch official GeoJSON at web-display resolution, with bounded retries."""
    layer = 4 if state == "MO" else 0
    field = "CD119" if state == "MO" else "CD120"
    query = urlencode({
        "where": f"STATE='{STATE_FIPS[state]}'",
        "outFields": f"STATE,GEOID,NAME,CENTLAT,CENTLON,{field}",
        "returnGeometry": "true",
        "outSR": "4326",
        "geometryPrecision": "5",
        "maxAllowableOffset": "0.0015",
        "f": "geojson",
    })
    source = f"{BASE}/{layer}/query?{query}"
    last = None
    for attempt in range(3):
        try:
            req = Request(source, headers={
                "User-Agent": "SportingLifeTimes-politics-public-mapping/1.0",
                "Accept": "application/geo+json, application/json",
            })
            with urlopen(req, timeout=55) as reply:
                data = json.load(reply)
            if data.get("error"):
                raise ValueError("Census server error: " + str(data["error"]))
            # Census emits CD=ZZ for unassigned water / similar areas, not an elected seat.
            # Keep only the valid district features and still require every actual district.
            data["features"] = [
                feature for feature in data.get("features", [])
                if feature.get("properties", {}).get(field) != "ZZ"
            ]
            data["meta"] = {
                "state": state,
                "source_url": source,
                "layer": layer,
                "field": field,
                "election": "2026-11-03",
                "boundary_vintage": "119th_reinstated_for_MO" if state == "MO" else "120th_2026",
            }
            return state, data
        except (OSError, TimeoutError, ValueError) as ex:
            last = ex
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"Failed official {state} geography: {last}")


def verify(state: str, data: dict, expected: set[str]) -> None:
    if data.get("type") != "FeatureCollection":
        raise ValueError(f"{state}: source did not provide GeoJSON FeatureCollection")
    field = "CD119" if state == "MO" else "CD120"
    seen = set()
    for feature in data.get("features", []):
        raw = feature.get("properties", {}).get(field)
        if raw is None:
            raise ValueError(f"{state}: missing district field {field}")
        ident = f"{state}-{str(raw).zfill(2)}"
        if ident not in expected or ident in seen:
            raise ValueError(f"{state}: duplicate or unexpected district {ident}")
        geometry = feature.get("geometry", {})
        if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            raise ValueError(f"{state}: missing polygon geometry for {ident}")
        if not geometry.get("coordinates"):
            raise ValueError(f"{state}: empty geometry for {ident}")
        seen.add(ident)
    if seen != expected:
        raise ValueError(f"{state}: geometry ID mismatch. Missing={sorted(expected-seen)}, unexpected={sorted(seen-expected)}")
    if data.get("meta", {}).get("layer") != (4 if state == "MO" else 0):
        raise ValueError(f"{state}: wrong congressional map vintage")


def build() -> None:
    atlas = json.loads((ROOT / "politics-house-atlas.json").read_text(encoding="utf-8"))
    if atlas.get("district_count") != 435 or atlas.get("state_count") != 50:
        raise ValueError("House atlas incomplete; refuse to publish geography")
    expected = {code: {d["id"] for d in atlas["districts"] if d["state"] == code}
                for code in STATE_FIPS}
    if sum(map(len, expected.values())) != 435:
        raise ValueError("Atlas district IDs mismatch; cannot build")
    downloaded = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(api_request, code): code for code in STATE_FIPS}
        for future in concurrent.futures.as_completed(futures):
            code, data = future.result()
            verify(code, data, expected[code])
            downloaded[code] = data
            print(f"Validated Census boundaries for {code}: {len(data['features'])} House district(s)", flush=True)
    if len(downloaded) != 50:
        raise ValueError("Not all 50 states validated; refuse partial map publication")
    target = ROOT / "politics-geometry"
    target.mkdir(parents=True, exist_ok=True)
    # Download and validate all states before writing any new map: never publish partial geography.
    for code in sorted(downloaded):
        packed = json.dumps(downloaded[code], separators=(",", ":"), ensure_ascii=False)
        tmp = target / f".{code}.geojson.tmp"
        tmp.write_text(packed + "\n", encoding="utf-8")
        os.replace(tmp, target / f"{code}.geojson")
    manifest = {
        "status": "CENSUS_2026_GEOGRAPHY_ALL_435_DISTRICTS_VERIFIED",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "states": 50,
        "districts": 435,
        "source": BASE,
        "missouri_2026_fallback": "119th Congress boundaries",
        "usage": "Geographic display only. Never treat geometry as a source for 2026 election projections.",
    }
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Validated all 435 districts across 50 states. Static geography complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true",
                        help="Validate any already-generated static GeoJSON against the atlas")
    args = parser.parse_args()
    if args.validate_only:
        atlas = json.loads((ROOT / "politics-house-atlas.json").read_text(encoding="utf-8"))
        for code in STATE_FIPS:
            ids = {r["id"] for r in atlas["districts"] if r["state"] == code}
            data = json.loads((ROOT / "politics-geometry" / f"{code}.geojson").read_text())
            verify(code, data, ids)
        print("All 435 cached polygons verified")
    else:
        build()

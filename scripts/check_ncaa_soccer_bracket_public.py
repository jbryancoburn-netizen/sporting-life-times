#!/usr/bin/env python3
"""Fail release when the actual public NCAA soccer selection page is stale.

The HTML/CSS/JS are copied without transformation into the Pages artifact.
Data JSON is compared semantically to handle safe whitespace compaction.
"""
import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    "college-soccer-selection.html",
    "college-soccer-selection.js",
    "college-soccer-national-bracket.js",
    "college-soccer-national-bracket.css",
)
DATA = "data/college-soccer-ncaa-selection-forecast.json"


def verify(base_url):
    for path in ASSETS:
        expected = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        url = urljoin(base_url.rstrip("/") + "/", path) + "?ncaa-bracket-check=20261116"
        with urlopen(Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "SLT-Soccer-Bracket-Release/1.0"}), timeout=18) as response:
            served = response.read()
            if response.status != 200 or hashlib.sha256(served).hexdigest() != expected:
                raise ValueError("Public asset differs from source: " + path)
    with urlopen(Request(urljoin(base_url.rstrip("/") + "/", DATA) + "?ncaa-bracket-check=20261116",
                         headers={"Cache-Control": "no-cache", "User-Agent": "SLT-Soccer-Bracket-Release/1.0"}), timeout=18) as response:
        published = json.loads(response.read().decode("utf-8"))
    expected_data = json.loads((ROOT / DATA).read_text(encoding="utf-8"))
    if published != expected_data:
        raise ValueError("Public 2026 NCAA soccer selection inputs differ from repository")
    if len(published.get("field") or []) != 48 or len(published.get("automatic_bid_scenarios") or []) != 23:
        raise ValueError("Published NCAA-format field lost its 48/23 contract")
    local_path = "data/college-soccer-local-crest-manifest.json"
    with urlopen(Request(urljoin(base_url.rstrip("/") + "/", local_path) +
                         "?ncaa-bracket-check=20261116",
                         headers={"Cache-Control": "no-cache",
                                  "User-Agent": "SLT-Soccer-Bracket-Release/1.0"}), timeout=18) as response:
        public_logos = json.loads(response.read().decode("utf-8"))
    local_logos = json.loads((ROOT / local_path).read_text(encoding="utf-8"))
    if public_logos != local_logos:
        raise ValueError("Public school logo directory differs from approved local archive")
    if public_logos.get("covered_team_count") != 213:
        raise ValueError("NCAA soccer local logo directory does not cover 213 schools")
    if any("men-d1:" + x["team_id"] not in public_logos["teams"]
           for x in published["field"]):
        raise ValueError("Active tournament projection contains teams with missing local crests")
    # The entirely separate NCAA RPI-led 48-school model must also be served.
    # A successful RETRO publication alone is not a verified NCAA comparison.
    for model_path in (
        "data/college-soccer-ncaa-rpi-nov14-2026.json",
        "data/college-soccer-ncaa-automatic-bids-2026.json",
        "data/college-soccer-ncaa-selection-projection-2026.json",
    ):
        model_url = urljoin(base_url.rstrip("/") + "/", model_path) + "?ncaa-bracket-check=20261116"
        with urlopen(Request(model_url, headers={"Cache-Control": "no-cache",
                       "User-Agent": "SLT-Soccer-Bracket-Release/1.0"}), timeout=18) as response:
            public_model = json.loads(response.read().decode("utf-8"))
        source_model = json.loads((ROOT / model_path).read_text(encoding="utf-8"))
        if public_model != source_model:
            raise ValueError("Public NCAA selection model is missing or stale: " + model_path)
    official_proxy = json.loads((ROOT / "data/college-soccer-ncaa-selection-projection-2026.json").read_text(encoding="utf-8"))
    if (official_proxy.get("independent_of_retro") is not True or
        official_proxy.get("status") != "final_preselection_rpi_led_ncaa_criteria_projection_not_official" or
        len(official_proxy.get("field", [])) != 48 or
        sum(x.get("bid_type") == "official_aq" for x in official_proxy["field"]) != 23 or
        sum(x.get("bid_type") == "rpi_at_large_projection" for x in official_proxy["field"]) != 25):
        raise ValueError("Live NCAA model violates independent 48/23/25 criteria")
    if any(x.get("ncaa_seed") is not None for x in official_proxy["field"]):
        raise ValueError("Unannounced official NCAA seeds must never be invented")
    page = (ROOT / ASSETS[0]).read_text(encoding="utf-8")
    if not all(name in page for name in ASSETS[1:]):
        raise ValueError("Live NCAA selection HTML does not reference the complete bracket assets")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--attempts", type=int, default=12)
    ap.add_argument("--interval", type=int, default=9)
    args = ap.parse_args()
    if args.attempts < 1:
        ap.error("--attempts must be positive")
    for attempt in range(1, args.attempts + 1):
        try:
            verify(args.root)
            print("PASS: public NCAA soccer selection HTML, bracket JS, CSS, all 213 local school logos, NCAA RPI model and RETRO selection data match source")
            return
        except Exception as e:
            print("Public soccer bracket verification attempt", attempt, "of", args.attempts, ":", str(e), flush=True)
            if attempt < args.attempts:
                time.sleep(args.interval)
    raise SystemExit("FAIL: public NCAA soccer bracket not independently verified")


if __name__ == "__main__":
    main()

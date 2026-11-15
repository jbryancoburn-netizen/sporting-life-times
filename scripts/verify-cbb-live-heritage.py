#!/usr/bin/env python3
"""Fail-closed verification that GitHub Pages serves the committed CBB PNGs."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import URLError,HTTPError
from hashlib import sha256
from time import sleep
from urllib.parse import quote
import sys

BASE="https://jbryancoburn-netizen.github.io/sporting-life-times/"
SCHOOLS=[
 "assets/cbb-atlantic-10-1980s/fordham.png",
 "assets/cbb-atlantic-10-1980s/george-mason.png",
 "assets/cbb-atlantic-10-1980s/vcu.png",
 "assets/cbb-mountain-west-1980s/new-mexico.png",
 "assets/cbb-mountain-west-1980s/san-jose-state.png",
]
ROOT=Path(__file__).resolve().parent.parent
SOURCE=(ROOT/"mbb-logo-system.js").read_text()
VER="source-optical-audit-20261115-2"
def grab(uri):
    with urlopen(Request(BASE+uri,headers={"User-Agent":"SportingLifeTimes-PublicLogoAudit/1.0","Cache-Control":"no-cache"}),timeout=15) as r:
        if r.status!=200:
            raise RuntimeError(f"HTTP {r.status} {uri}")
        return r.read()
for attempt in range(1,13):
    try:
        live=grab("mbb-logo-system.js?v="+VER)
        for path in SCHOOLS:
            expected=(ROOT/path).read_bytes()
            delivered=grab(path+"?v="+VER)
            if sha256(expected).digest()!=sha256(delivered).digest():
                raise RuntimeError(f"PUBLIC IMAGE MISMATCH: {path}")
            if (path+"?v="+VER).encode() not in live:
                raise RuntimeError(f"PUBLIC RENDERER VERSION MISMATCH: {path}")
            print("VERIFIED_PUBLIC_ART",path,len(expected),flush=True)
        for page in ["ncaam-elo.html","ncaaw-rankings.html"]:
            grab(page+"?audit="+VER)
            print("VERIFIED_PUBLIC_PAGE",page,flush=True)
        print("PASS: all five new local source PNGs and public logo mappings confirmed",flush=True)
        sys.exit(0)
    except (URLError,HTTPError,RuntimeError,OSError) as error:
        print(f"Attempt {attempt}/12: {error}",flush=True)
        if attempt<12:
            sleep(5)
raise SystemExit("FAIL: GitHub Pages did not serve the committed source PNGs")

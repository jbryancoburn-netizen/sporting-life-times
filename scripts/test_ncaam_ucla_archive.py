#!/usr/bin/env python3
"""Verify UCLA archive collector attaches season to each link and excludes modern links."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path("scripts").resolve()))
from acquire_ncaam_ucla_historical_archive import discover
sample=b'''<h2>2025-26 Season</h2><a href="/recent.pdf">Results (PDF)</a>
<h2>1983-84 Season</h2><a href="/1984-results.pdf">Results (PDF)</a>
<h2>1955-56 Season</h2><a href="/1956-stats.pdf">Statistics (PDF)</a>
<h2>1939-40 Season</h2><a href="/1940-stats.pdf">Statistics (PDF)</a>'''
got=discover(sample)
assert [x["season"] for x in got]==[1984,1956],got
assert all(x["url"].startswith("https://uclabruins.com/") for x in got)
print("PASS pre-1985 UCLA source season binding and no modern document leakage")

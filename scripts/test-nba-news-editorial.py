#!/usr/bin/env python3
"""Fail if the NBA newsroom or cached feed allows sportsbook advertisements."""
import importlib.util
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("nba_stories",root/"scripts/collect-nba-stories.py")
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
bad=[
"Use BetMGM bonus code CBSSPORTS to get $1,500 bonus bets",
"Use DraftKings promo code to get $200 bonus",
"Brewers vs. Rays World Series Game 1 best bets",
"NBA player props and sportsbook odds boosts",
"Fantasy basketball betting picks"]
good=["Chicago Bulls win at Milwaukee Bucks","Knicks make roster transaction","NBA player injury updates","Wembanyama dominates in Spurs win"]
for t in bad: assert not collector.editorial({"title":t}),"Promotional article passed: "+t
for t in good: assert collector.editorial({"title":t}),"Legitimate news rejected: "+t
feed=json.loads((root/"data/nba-top-stories.json").read_text())
offenders=[a["title"] for a in feed["articles"] if not collector.editorial(a)]
assert not offenders,"Promotional articles remain in published NBA feed: "+repr(offenders[:10])
js=(root/"nba-home.js").read_text()
assert "const editorial=" in js,"Missing browser side editorial defense"
print("PASS: NBA news feed and collector block promotional sports betting content")

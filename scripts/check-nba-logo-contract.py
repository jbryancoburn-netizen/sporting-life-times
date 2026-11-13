#!/usr/bin/env python3
"""NBA logo contract: 30 authentic archived choices, thick two-color rings and local fallback."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
expected = set("ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split())
pages = (
    "nba.html", "nba-rankings.html", "nba-standings.html", "nba-conference.html",
    "nba-playoffs.html", "nba-team-desk.html", "nba-game-center.html",
    "nba-live-game.html", "nba-matchups.html", "nba-players.html",
    "nba-cup.html", "nba-predictions.html",
)
catalog = json.loads((ROOT / "data/nba-vintage-logos.json").read_text())
teams = catalog["teams"]
palette = json.loads((ROOT / "data/dual-ring-team-palette.json").read_text())["nba"]
assert set(teams) == expected, "Historical NBA manifest must cover exactly 30 teams"
assert set(palette) == expected, "Two-color NBA palette must cover exactly 30 teams"
assert {p.stem for p in (ROOT / "assets/nba-logos").glob("*.png")} == expected, "Local modern-logo fallback incomplete"
for code, mark in teams.items():
    assert mark["logo_url"].startswith("https://assets.logocdn.com/images/sports/nba/"), code
    assert "i.logocdn.com" not in mark["logo_url"], code
    assert mark["fallback_url"] == f"assets/nba-logos/{code}.png", code
    assert mark["team"] and mark["historical_identity"] and mark["era"], code
    lo = int(re.search(r"\d{4}", mark["era"]).group())
    years = [int(y) for y in re.findall(r"\d{4}", mark["era"])]
    hi = years[1] if len(years)>1 else 9999
    assert hi >= lo, f"Invalid era {code}"
    if code not in {"MEM", "NOP", "TOR"}:
        assert lo <= 1989 and hi >= 1980, f"1980s-era logo absent for {code}"
    color_pair = (mark.get("ring_primary", palette[code]["primary"]), mark.get("ring_secondary", palette[code]["secondary"]))
    assert all(re.fullmatch(r"#[0-9A-Fa-f]{6}", c) for c in color_pair), f"Bad colors for {code}"
    assert color_pair[0].lower() != color_pair[1].lower(), f"Unidentifiable rings for {code}"

js = (ROOT / "slt-dual-ring.js").read_text()
css = (ROOT / "slt-dual-ring.css").read_text()
assert "archivalNBAImage(img,entry)" in js, "Missing historic image substitution"
assert "img.setAttribute('src',original)" in js, "Missing local fallback on image error"
assert "if(league==='nba')" in js, "Changes should be NBA-scoped"
assert "slt-nba-bold-rings" in js and "slt-nba-bold-rings" in css
assert "--slt-nba-crest-stroke:4px" in css and "--slt-nba-crest-stroke:3.5px" in css
assert "body.slt-nba-bold-rings .slt-dual-shell::before" in css, "Inner-color border not controlled"
assert "shared-team-crests.js" not in (ROOT / "nba.html").read_text(), "Competing global logo wrappers"

for name in pages:
    html = (ROOT / name).read_text()
    assert "slt-dual-ring.css?v=20261113-vintage-bold-rings" in html, f"Ring CSS not loaded by {name}"
    assert "slt-dual-ring.js?v=20261113-vintage-bold-rings" in html, f"Ring JS not loaded by {name}"

gallery = (ROOT / "nba-vintage-logo-gallery.html").read_text()
assert "https://i.logocdn.com/nba/" not in gallery, "Gallery still references broken image hostname"
assert "https://assets.logocdn.com/images/sports/nba/" in gallery
core = (ROOT / "nba-newspaper.js").read_text()
assert "const logo=c=>'assets/nba-logos/'" in core, "Modern local fallback source must stay intact"
print("PASS: NBA 30-team vintage catalog, wider two-color rings, 12 page includes, modern local fallback.")

#!/usr/bin/env python3
"""Prevent real Big Ten soccer playoff results from reverting to RETRO simulations."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / "data/college-soccer-men-d1-big-ten-standings.json").read_text())
bracket = data["tournament_bracket"]
assert bracket["status"] == "official" and bracket["source_url"].startswith("https://")
assert bracket["verified_through"] >= "2026-11-11"
assert data["last_verified_game_date"] >= "2026-11-11"
matches = bracket["matches"]
assert len(matches) == 5
assert len({(m["round"], m["home_id"], m["away_id"]) for m in matches}) == 5
expected = [
    ("michigan-st","maryland",1,2,"maryland"),
    ("rutgers","ucla",2,0,"rutgers"),
    ("indiana","maryland",1,0,"indiana"),
    ("washington","rutgers",1,1,"washington")
]
for (home, away, hs, vs, winner), game in zip(expected, matches):
    assert (game["home_id"],game["away_id"]) == (home,away), "Official bracket identity changed"
    assert (game["home_score"],game["away_score"]) == (hs,vs), "Verified score overwritten"
    assert game["status"] == "final" and game["winner_id"] == winner, "Verified advancing team overwritten"
assert matches[3]["decision"] == "penalties" and (matches[3]["home_penalties"],matches[3]["away_penalties"]) == (3,2), "Penalty advancement must remain verified"
final = matches[-1]
assert (final["home_id"],final["away_id"]) == ("indiana","washington")
assert final["status"] in ("scheduled","final")
if final["status"] == "final":
    assert final.get("winner_id") in ("indiana","washington")
    assert isinstance(final.get("home_score"),int) and isinstance(final.get("away_score"),int)
standings = {r["team_id"]:r for r in data["rows"]}
for team in ("indiana","washington","rutgers","maryland"):
    assert standings[team]["overall_record"].count("-") == 2, "Broken overall record"
for team in standings:
    assert standings[team]["conference_record"], "Missing frozen league record"
page = (root / "college-soccer-big-ten-men.html").read_text()
js = (root / "college-soccer-conference-page.js").read_text()
assert "college-soccer-conference-page.js?v=" in page and "college-soccer-conference-page.css?v=" in page
assert "root.insertBefore(bracket,columns)" in js, "Official bracket must appear before rankings and forecasts"
assert "const bracketVerified=" in js and "if(bracketVerified)" in js
assert "cs-official-winner" in js and "cs-official-score" in js, "Played match winner/score labels missing"
assert "for(const [index,team] of names.entries())" in js, "Club/index order reversed in official bracket"
assert "for(const [team,index] of names.entries())" not in js, "Broken renderer reintroduced"
assert "if(decidedTitle)" in js and "titleFixture?.home_id&&titleFixture?.away_id" in js
print("PASS: Big Ten four real knockout results, shootout winner, future-safe championship, bracket first, RETRO separately identified")

#!/usr/bin/env python3
"""Check NBA Cup result persistence without hitting a live sports API."""
import importlib.util
from pathlib import Path

script = Path(__file__).with_name("persist_nba_cup_results.py")
spec = importlib.util.spec_from_file_location("nba_cup_results", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def game(state="post", away="BOS", home="CHA", away_score=119, home_score=80):
    return {
        "id": "espn-nba-test", "date": "2026-11-07T00:00:00Z",
        "state": state,
        "teams": [
            {"home_away": "away", "code": away, "score": away_score},
            {"home_away": "home", "code": home, "score": home_score},
        ],
    }


key = "2026-11-06|BOS|CHA"
assert key in module.extract_final_matches({"games": [game()]}, "schedule")
assert not module.extract_final_matches({"games": [game(state="in")]}, "schedule")
assert key not in module.extract_final_matches(
    {"games": [game(away="CHA", home="BOS")]}, "schedule"
)
doc = {"fixtures": [
    {"key": key, "result": None},
    {"key": "2026-11-13|BOS|ATL", "result": None},
]}
matches = module.extract_final_matches({"games": [game()]}, "schedule")
assert module.apply_results(doc, matches) == (1, 0)
assert doc["fixtures"][0]["result"]["away_score"] == 119
assert doc["fixtures"][1]["result"] is None
assert module.apply_results(doc, matches) == (0, 0)
altered = module.extract_final_matches(
    {"games": [game(away_score=100, home_score=99)]}, "schedule"
)
assert module.apply_results(doc, altered) == (0, 1)
assert doc["fixtures"][0]["result"]["away_score"] == 119
assert module.apply_results({"fixtures": [{"key": key, "result": None}]}, matches, {key}) == (0, 1)
print("NBA Cup final matching, Eastern dates, live rejection and conflict protection: PASS")

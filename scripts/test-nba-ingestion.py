#!/usr/bin/env python3
"""Offline NBA ingestion smoke test. No invented production observations."""
import importlib.util
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/collect_nba_game_center.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sample_game={"gameId":"0022600001","gameTimeUTC":"2026-10-23T23:00:00Z","gameStatus":3,"gameStatusText":"Final",
 "awayTeam":{"teamCity":"Boston","teamName":"Celtics","teamTricode":"BOS","score":109},
 "homeTeam":{"teamCity":"New York","teamName":"Knicks","teamTricode":"NYK","score":116}}
sample_box={"game":{"awayTeam":{"teamTricode":"BOS","score":109,"statistics":{"fieldGoalsAttempted":86,"reboundsOffensive":10,"turnoversTotal":13,"freeThrowsAttempted":25},"players":[{"personId":42,"name":"Synthetic Test Athlete","played":True,"statistics":{"points":20,"reboundsTotal":7,"assists":5,"steals":1,"blocks":0,"turnovers":2,"fieldGoalsMade":8,"fieldGoalsAttempted":16,"threePointersMade":2,"threePointersAttempted":5,"freeThrowsMade":2,"freeThrowsAttempted":2}}]},
 "homeTeam":{"teamTricode":"NYK","score":116,"statistics":{"fieldGoalsAttempted":88,"reboundsOffensive":12,"turnoversTotal":11,"freeThrowsAttempted":18},"players":[]}}}
with patch.object(module,"fetch",return_value=sample_box):
    game=module.game_record(sample_game)
assert game["state"]=="post" and len(game["players"])==1 and game["players"][0]["pts"]==20
assert game["official_stats"]["away"]["fga"]==86 and game["official_stats"]["home"]["points"]==116
assert game["leaders"][0]["name"]=="Synthetic Test Athlete"
with tempfile.TemporaryDirectory() as temp:
    module.ROOT=Path(temp)
    with patch.object(module,"fetch",return_value={"scoreboard":{"games":[]}}):
        try:module.main()
        except RuntimeError as e:assert "zero" in str(e) or "No completed" in str(e)
        else:raise AssertionError("Empty NBA archive must not publish")
    assert not (Path(temp)/"data/nba-game-center.json").exists()
print("PASS: official NBA player and team stats parsed; empty publication rejected")

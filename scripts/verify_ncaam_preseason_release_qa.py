#!/usr/bin/env python3
"""Reproduce frozen NCAA 2026-27 preseason QA without changing rankings."""
import json, math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1] / "data"
ratings=json.loads((ROOT/"ncaam-2026-27-preseason-roster-informed.json").read_text())
qa=json.loads((ROOT/"ncaam-2026-27-preseason-release-qa.json").read_text())
rows=ratings["rankings"]
assert ratings["season"]==qa["season"]=="2026-27"
assert ratings["model"]==qa["ratings_model"]
assert len(rows)==365 and len({x["team_id"] for x in rows})==365
assert all(x["rank"]==i for i,x in enumerate(rows,1))
assert all(i==0 or rows[i-1]["elo"]>=x["elo"] for i,x in enumerate(rows))
assert all(math.isfinite(x["elo"]) and
           abs(x["elo"]-x["base_elo"]-x["offseason_adjustment"])<.00021 for x in rows)
assert ratings["games_played"]==qa["games_played"]==0
fallback=[x["team"] for x in rows if x["roster_coverage"]=="baseline-fallback"]
assert fallback==qa["uncovered_programs"]
flags=sorted(({"team":x["team"],"rank":x["rank"],"adjustment":x["offseason_adjustment"]}
              for x in rows if abs(x["offseason_adjustment"])>=90),
             key=lambda x:abs(x["adjustment"]),reverse=True)
assert flags==qa["large_offseason_adjustment_flags"]
assert [{"rank":x["rank"],"team":x["team"],"elo":x["elo"]} for x in rows[:10]]==qa["ranking_top_10"]
assert qa["production_approval"] is False and qa["complete_preseason_rankings_available"] is True
assert qa["decision"]=="PUBLISH_PROVISIONAL_365_TEAM_ROSTER_INFORMED_ELO"
print("PASS: 365-team NCAA preseason release QA, explicit provisional model, exception flags")

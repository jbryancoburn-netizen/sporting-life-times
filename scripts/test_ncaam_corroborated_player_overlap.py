#!/usr/bin/env python3
"""Prevent double counting corroborated player history already present in NCAA crosswalk."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
read=lambda name:json.loads((ROOT/"data"/name).read_text())

def audit():
    historic=read("ncaam-2026-27-historical-athlete-links.json")
    crosswalk=read("ncaam-2026-27-direct-player-crosswalk.json")
    reported=read("ncaam-2026-27-corroborated-player-overlap-audit.json")
    lookup={}
    for x in crosswalk["links"]:
        key=str(x["id"])
        assert key not in lookup, "Duplicate athlete in crosswalk"
        lookup[key]=x
    matches={}
    for x in historic["matched"]:
        key=str(x["espn_athlete_id"])
        assert key not in matches, "Duplicate corroborated player"
        matches[key]=x
    assert len(matches)==30 and len(reported["rows"])==30
    for row in reported["rows"]:
        key=str(row["espn_athlete_id"])
        assert key in matches and key in lookup
        assert row["same_historical_id"] is True
        assert str(lookup[key]["pid"])==str(matches[key]["historical_ncaa_player_id"])
        assert str(row["historical_ncaa_player_id"])==str(lookup[key]["pid"])
    assert reported["new_historical_id_links"]==0
    assert reported["additional_player_minutes_authorized"]==0
    assert reported["preseason_elo_changed"] is False
    print("PASS: 30 previously linked athlete histories; zero duplicate Elo inputs")

if __name__=="__main__":audit()

#!/usr/bin/env python3
"""Fail-closed verification of school-documented 2026-27 player origins."""
import json
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT/path).read_text())

def verify():
    official=read("data/ncaam-2026-27-official-player-resolutions.json")["records"]
    overlay=read("data/ncaam-2026-27-official-player-origin-overlay.json")
    movement=read("data/ncaam-2026-27-player-movement-audit.json")
    roster={}
    for school in movement["teams"]:
        for p in school["players"]:
            pid=str(p["current_id"])
            if pid in roster: raise AssertionError("Duplicate current athlete ID")
            roster[pid]=(school,p)
    assert len(roster)==5537
    originals={}
    for p in official:
        pid=str(p["espn_athlete_id"])
        assert pid not in originals and pid in roster, "Missing or duplicate official athlete"
        school,person=roster[pid]
        assert school["team_id"]==p["team_id"] and person["player"]==p["name"], "Official/current roster identity mismatch"
        assert p["classification"] in ("returner","transfer","new-to-d1")
        assert p["source_url"].startswith("https://"), "Missing official evidence URL"
        if p["classification"]=="returner":assert p["prior_team_id"]==p["team_id"]
        if p["classification"]=="transfer":assert p["prior_team_id"] and p["prior_team_id"]!=p["team_id"]
        if p["classification"]=="new-to-d1":assert p["prior_team_id"] is None
        originals[pid]=p
    published={}
    for p in overlay["records"]:
        pid=str(p["espn_athlete_id"])
        assert pid not in published and pid in originals
        source=originals[pid]
        assert p["name"]==source["name"] and p["team_id"]==source["team_id"]
        assert p["origin"]==source["classification"]
        assert p["verified_prior_team_id"]==source["prior_team_id"]
        assert p["source_url"]==source["source_url"]
        assert p["prior_box_id_verified"] is False and p["eligible_for_automatic_stat_join"] is False
        published[pid]=p
    assert set(published)==set(originals)
    assert overlay["counts"]==dict(Counter(p["classification"] for p in official))
    assert overlay["total"]==34 and overlay["publication_elo_changed"] is False
    print("PASS: 34 school-sourced origin classifications crosschecked with 5,537-player roster; zero unauthorized statistical joins")

if __name__=="__main__": verify()

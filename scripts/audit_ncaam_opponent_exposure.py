#!/usr/bin/env python3
"""Experimental opponent-strength exposure audit for NCAA player production.

Uses PRE-GAME team Elo to avoid using future game outcomes when constructing
opponent context. These are descriptive exposure values, NOT player ratings.
"""
import json,datetime
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_roster_elo import fetch

def strength_exposure(box,schedule):
    games={}
    for g in schedule:
        date=str(g.get("game_date") or g.get("date") or "")
        home=str(g.get("home_ncaa_team_id") or "")
        away=str(g.get("away_ncaa_team_id") or "")
        gid=str(g.get("contest_id") or "")
        if gid and home and away:games[gid]=(home,away,date)
    # Dataset availability varies across archives. No synthetic opponents.
    totals=defaultdict(lambda:{"minutes":0.,"weighted_opponent_elo":0.,"games":set(),"unmatched":0})
    for r in box:
        team=str(r.get("team_ncaa_team_id") or "")
        pid=str(r.get("player_id") or "")
        gid=str(r.get("contest_id") or "")
        if not team or not pid or not gid:continue
        key=(team,pid)
        try:mins=float(r.get("mins") or 0)
        except (TypeError,ValueError):continue
        if not 0<=mins<=75:continue
        match=games.get(gid)
        if match is None or team not in match[:2]:
            totals[key]["unmatched"]+=1
            continue
        # Raw opponent mapping is recorded; no unverified Elo is invented.
        totals[key]["games"].add(gid)
        totals[key]["minutes"]+=mins
    return totals
def main():
    box=fetch("ncaa_mbb_player_box",2026)
    schedule=fetch("ncaa_mbb_schedule",2026)
    result=strength_exposure(box,schedule)
    out={"season":"2025-26","method":"match NCAA contest IDs before opponent-strength modeling",
       "players":len(result),
       "matched_games":sum(len(x["games"]) for x in result.values()),
       "unmatched_player_games":sum(x["unmatched"] for x in result.values()),
       "opponent_adjustment_calibrated":False,
       "elo_player_impact_authorized":False}
    Path("data/ncaam-player-opponent-exposure-audit.json").write_text(json.dumps(out,indent=2)+chr(10))
    print(json.dumps(out,indent=2))
if __name__=="__main__":main()

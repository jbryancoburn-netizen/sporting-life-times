#!/usr/bin/env python3
"""Audit NCAA player-game opponent identities from same-source NCAA box records.

Player box rows contain team, home and away NCAA IDs directly. This avoids
cross-release contest-ID joins that yielded zero matches. No fabricated Elo.
"""
import json
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_roster_elo import fetch

def strength_exposure(box):
    players=defaultdict(lambda:{"games":set(),"opponents":set(),"minutes":0.})
    unmatched=0;invalid=0;matched=0;seen=set()
    for r in box:
        team=str(r.get("team_ncaa_team_id") or "").strip()
        home=str(r.get("home_ncaa_team_id") or "").strip()
        away=str(r.get("away_ncaa_team_id") or "").strip()
        pid=str(r.get("player_id") or "").strip()
        gid=str(r.get("contest_id") or "").strip()
        if not team.isdigit() or not pid.isdigit() or not gid.isdigit():
            invalid+=1;continue
        if team==home and away.isdigit() and home!=away:opp=away
        elif team==away and home.isdigit() and home!=away:opp=home
        else:unmatched+=1;continue
        key=(team,pid,gid)
        if key in seen:raise ValueError("Duplicate player-game identity "+str(key))
        seen.add(key)
        try:mins=float(r.get("mins") or 0)
        except (TypeError,ValueError):invalid+=1;continue
        if not 0<=mins<=75:invalid+=1;continue
        p=players[(team,pid)]
        p["games"].add(gid);p["opponents"].add(opp);p["minutes"]+=mins
        matched+=1
    return {"players":len(players),"matched_player_games":matched,
        "unmatched_player_games":unmatched,"invalid_player_games":invalid,
        "distinct_opponents":len({opp for x in players.values() for opp in x["opponents"]}),
        "identity_source":"NCAA IDs within same player-game box row",
        "opponent_adjustment_calibrated":False,
        "elo_player_impact_authorized":False}
def main():
    rows=fetch("ncaa_mbb_player_box",2026)
    out={"season":"2025-26","source":"NCAA-origin SportsDataverse player box",
         "total_player_game_rows":len(rows),**strength_exposure(rows)}
    Path("data/ncaam-player-opponent-exposure-audit.json").write_text(json.dumps(out,indent=2)+chr(10))
    print(json.dumps(out,indent=2))
    if out["matched_player_games"]<100000:raise ValueError("Opponent identity coverage insufficient")
if __name__=="__main__":main()

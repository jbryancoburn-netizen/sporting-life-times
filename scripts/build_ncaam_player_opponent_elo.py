#!/usr/bin/env python3
"""Player competition exposure using independent PRE-GAME NCAA team Elo.

Historical games replayed chronologically. Player games join NCAA contest ID,
team and opponent; no future result enters any pregame opponent rating.
Descriptive only; never used to change production Elo without validation.
"""
import json,math
from collections import defaultdict
from pathlib import Path
from backtest_ncaam_roster_elo import fetch,games,step,clean

def pregame_opponents(schedule,members):
    """Snapshot opponent Elo at start of each date; no same-day score leakage.

    Historical schedules have dates but no reliable intraday tipoff order.
    Every contest on a given date therefore sees the same pre-date Elo.
    """
    played,known=games(schedule,members)
    ratings={t:1500. for t in known}
    pre={}
    index=0
    while index<len(played):
        day=played[index][0]
        batch=[]
        while index<len(played) and played[index][0]==day:
            batch.append(played[index])
            index+=1
        for _,gid,home,away,hs,aws in batch:
            pre[gid]={home:ratings[away],away:ratings[home]}
        for _,gid,home,away,hs,aws in batch:
            step(ratings,home,away,hs,aws)
    return pre

def exposure(rows,pre):
    out=defaultdict(lambda:{"minutes":0.,"weighted":0.,"games":0,"points":0.})
    unmatched=0;invalid=0;seen=set()
    for row in rows:
        team=clean(row.get("team"))
        gid=str(row.get("contest_id") or "").strip()
        pid=str(row.get("player_id") or "").strip()
        if not team or not gid or not pid:invalid+=1;continue
        if (team,pid,gid) in seen:raise ValueError("Duplicate player game")
        seen.add((team,pid,gid))
        value=pre.get(gid,{}).get(team)
        if value is None:unmatched+=1;continue
        try:
            mins=float(row.get("mins") or 0)
            pts=float(row.get("pts") or 0)
        except (TypeError,ValueError):invalid+=1;continue
        if not (math.isfinite(mins) and 0<=mins<=75 and math.isfinite(pts) and pts>=0):
            invalid+=1;continue
        source_team=str(row.get("team_ncaa_team_id") or "").strip()
        if not source_team or not source_team.isdigit():invalid+=1;continue
        x=out[(team,pid,source_team)]
        x["minutes"]+=mins;x["weighted"]+=value*mins;x["games"]+=1;x["points"]+=pts
    players=[{"team_key":t,"historical_player_id":pid,"minutes":round(x["minutes"],2),
       "games":x["games"],"points":round(x["points"],2),
       "opponent_pregame_elo":round(x["weighted"]/x["minutes"],2) if x["minutes"]>0 else None,
       "historical_team_id":"ncaa:"+source_team,
       "quality_status":"descriptive-not-calibrated"} for (t,pid,source_team),x in out.items()]
    return {"matched_player_games":sum(x["games"] for x in out.values()),
       "unmatched_player_games":unmatched,"invalid_player_games":invalid,
       "players":len(players),"player_exposure":sorted(players,key=lambda x:(x["team_key"],x["historical_player_id"]))}

def main():
    sched=fetch("ncaa_mbb_schedule",2026)
    members=fetch("ncaa_mbb_team_ids",2026)
    box=fetch("ncaa_mbb_player_box",2026)
    pre=pregame_opponents(sched,members)
    result=exposure(box,pre)
    report={"season":"2025-26","team_model":"independent venue-neutral historical Elo",
       "temporal_integrity":"pre-game opponent rating only; historical schedule sorted by date and contest ID",
       "historical_games":len(pre),"source_player_rows":len(box),
       "production_elo_approved":False,**result}
    assert report["historical_games"]>=5000
    assert report["matched_player_games"]>=100000,report["matched_player_games"]
    Path("data/ncaam-2025-26-opponent-adjusted-player-exposure.json").write_text(json.dumps(report,indent=2)+chr(10))
    print(json.dumps({k:v for k,v in report.items() if k!="player_exposure"},indent=2))
if __name__=="__main__":main()

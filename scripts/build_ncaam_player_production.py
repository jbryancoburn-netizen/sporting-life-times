#!/usr/bin/env python3
"""Auditable NCAA D1 player production ledger; NOT a new Elo coefficient.

Uses box-score production, not just minutes. Only NCAA-origin archived
observations. Produces player-level per-game and per-40 rates and explicitly
marks opponent-strength adjustment as NOT YET CALIBRATED.
"""
import json,math
from pathlib import Path
from collections import defaultdict
from backtest_ncaam_roster_elo import fetch

STAT_FIELDS=("mins","pts","orb","drb","ast","stl","blk","tov","fga","fta","fgm","tpm")
def value(row,key):
    try:
        x=float(row.get(key) or 0)
        return x if math.isfinite(x) and x>=0 else None
    except (ValueError,TypeError):return None

def aggregate(rows):
    players={}
    seen=set()
    for row in rows:
        school=str(row.get("team_ncaa_team_id") or "").strip()
        pid=str(row.get("player_id") or "").strip()
        gid=str(row.get("contest_id") or "").strip()
        if not school.isdigit() or not pid.isdigit() or not gid.isdigit():continue
        key=(school,pid,gid)
        if key in seen:raise ValueError("Duplicate player contest: "+str(key))
        seen.add(key)
        data={field:value(row,field) for field in STAT_FIELDS}
        if any(v is None for v in data.values()) or data["mins"]>75:continue
        pkey=(school,pid)
        if pkey not in players:
            players[pkey]={"team_id":"ncaa:"+school,"player_id":pid,
                "name":row.get("clean_name") or row.get("player"),
                "team_name":row.get("team"),"games":0,
                "totals":{field:0. for field in STAT_FIELDS}}
        player=players[pkey]
        player["games"]+=1
        for field,v in data.items():player["totals"][field]+=v
    out=[]
    for p in players.values():
        mins=p["totals"]["mins"]
        p["minutes"]=round(mins,2)
        p["rates_per_40"]={field:round(40*p["totals"][field]/mins,3) if mins>=40 else None
             for field in STAT_FIELDS if field!="mins"}
        p["true_shooting"]=round(p["totals"]["pts"]/(2*(p["totals"]["fga"]+.44*p["totals"]["fta"])),4) if p["totals"]["fga"]+.44*p["totals"]["fta"]>0 else None
        p["effective_fg"]=round((p["totals"]["fgm"]+.5*p["totals"]["tpm"])/p["totals"]["fga"],4) if p["totals"]["fga"]>0 else None
        p["reliability"]="low-sample" if mins<200 else "observed"
        out.append(p)
    return sorted(out,key=lambda x:(x["team_id"],x["player_id"]))
def main():
    rows=aggregate(fetch("ncaa_mbb_player_box",2026))
    assert len(rows)>3000
    teams=len({x["team_id"] for x in rows})
    report={"season":"2025-26","source":"NCAA-origin player game box scores via SportsDataverse",
       "players":len(rows),"teams":teams,"stat_definitions":"Totals and per-40 rates; no inferred player Elo",
       "opponent_strength_adjusted":False,"transfer_elo_coefficient_authorized":False,
       "notes":["Raw minutes alone never represent player quality",
                "Opponent and conference adjustment is required before production use",
                "Player IDs must be checked against current roster identity namespace"],
       "player_records":rows}
    path=Path("data/ncaam-2025-26-player-production-ledger.json")
    path.write_text(json.dumps(report,separators=(",",":"))+"\n")
    print("Audited",len(rows),"players across",teams,"NCAA teams")
if __name__=="__main__":main()

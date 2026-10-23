#!/usr/bin/env python3
"""Join historical opponent-Elo exposure to 2027 roster identity CANDIDATES.

Exact normalized name + unique historical NCAA team/player pair required.
No ESPN/NCAA athlete ID equivalence assumed. This is a diagnostic only.
"""
import json,re,argparse
from collections import defaultdict,Counter
from pathlib import Path
from backtest_ncaam_roster_elo import fetch

def normalize(name):
    return re.sub(r"[^a-z0-9]","",str(name or "").lower())

def build_index(box):
    ids=defaultdict(set)
    for row in box:
        team=str(row.get("team_ncaa_team_id") or "")
        pid=str(row.get("player_id") or "")
        name=normalize(row.get("clean_name") or row.get("player"))
        if team.isdigit() and pid.isdigit() and name:
            ids[("ncaa:"+team,name)].add(pid)
    return ids

def reconcile(movement,exposure,box):
    ids=build_index(box)
    strengths={(x["team_key"],str(x["historical_player_id"])):x
               for x in exposure["player_exposure"]}
    counts=Counter();results=[]
    for school in movement["teams"]:
        summary=Counter();matched=[]
        for p in school["players"]:
            status=p["status"]
            if status not in ("unique-name-returner-candidate","unique-name-transfer-candidate"):
                summary["not_candidate"]+=1;continue
            source=p.get("prior_school_id")
            possible=ids.get((source,normalize(p["player"])),set())
            if len(possible)!=1:
                summary["historical_identity_ambiguous"]+=1;continue
            historical_id=next(iter(possible))
            observation=strengths.get((source.removeprefix("ncaa:"),historical_id))
            if observation is None:
                # Exposure uses normalized historical team NAME, not NCAA numeric ID.
                summary["exposure_join_unresolved"]+=1;continue
            if observation["minutes"]<200 or observation["opponent_pregame_elo"] is None:
                summary["insufficient_observed_minutes"]+=1;continue
            matched.append({"player":p["player"],"candidate_status":status,
                "historical_team_id":source,"historical_player_id":historical_id,
                "prior_minutes":observation["minutes"],
                "prior_opponent_pregame_elo":observation["opponent_pregame_elo"],
                "identity_verified":False})
            summary["competition_exposure_candidate"]+=1
        counts.update(summary)
        results.append({"team":school["team"],"team_id":school["team_id"],
            "counts":dict(summary),"candidate_exposure":matched})
    return {"season":"2026-27","roster_teams":len(results),"counts":dict(counts),
        "identity_verified":False,"production_elo_approved":False,
        "teams":results}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--movement",default="data/ncaam-2026-27-player-movement-audit.json")
    p.add_argument("--exposure",default="data/ncaam-2025-26-opponent-adjusted-player-exposure.json")
    p.add_argument("--out",default="data/ncaam-2026-27-candidate-opponent-exposure.json")
    a=p.parse_args()
    movement=json.loads(Path(a.movement).read_text())
    exposure=json.loads(Path(a.exposure).read_text())
    result=reconcile(movement,exposure,fetch("ncaa_mbb_player_box",2026))
    assert result["roster_teams"]==365
    Path(a.out).write_text(json.dumps(result,separators=(",",":"))+chr(10))
    print(json.dumps({"teams":result["roster_teams"],"counts":result["counts"]},indent=2))
if __name__=="__main__":main()

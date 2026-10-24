#!/usr/bin/env python3
"""Reconstruct sourced NBL regular-season standings from completed ESPN finals.
No Elo ratings, speculative games, or unverified official-standing claims.
"""
import json,sys
from collections import Counter
from datetime import date,datetime,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from stage_nbl_history import collect
from nbl_elo import TEAMS
START=date(2026,9,19)
def build(candidate):
    events=candidate.get("games",[])
    if candidate.get("status")!="uncertified_source_candidates" or not isinstance(events,list):
        raise ValueError("NBL source returned invalid snapshot")
    valid=[g for g in events if str(g.get("played_at",""))[:10]>=START.isoformat()]
    wins=Counter();losses=Counter();points_for=Counter();points_against=Counter()
    ids=set()
    for g in valid:
        if not g.get("id") or g["id"] in ids or g.get("verified") is not False:
            raise ValueError("Duplicate or unexpectedly certified NBL result")
        ids.add(g["id"])
        h,a=g["home"],g["away"]
        if h not in TEAMS or a not in TEAMS or h==a:raise ValueError("Unknown NBL club")
        hs,aws=g["home_score"],g["away_score"]
        if not isinstance(hs,int) or not isinstance(aws,int) or hs==aws:
            raise ValueError("Non-final result in NBL standings")
        points_for[h]+=hs;points_against[h]+=aws
        points_for[a]+=aws;points_against[a]+=hs
        if hs>aws:wins[h]+=1;losses[a]+=1
        else:wins[a]+=1;losses[h]+=1
    if not valid:raise ValueError("No NBL27 regular-season finals")
    rows=[{"team":t,"wins":wins[t],"losses":losses[t],"played":wins[t]+losses[t],
          "win_pct":round(wins[t]/(wins[t]+losses[t]),3) if wins[t]+losses[t] else None,
          "points_for":points_for[t],"points_against":points_against[t],
          "points_pct":round(100*points_for[t]/points_against[t],2) if points_against[t] else None}
          for t in TEAMS]
    # NBL tie-breaks on points percentage (points scored / points conceded).
    rows.sort(key=lambda r:(1 if r["win_pct"] is None else -r["win_pct"],
                            1 if r["points_pct"] is None else -r["points_pct"],r["team"]))
    return {"league":"Australian NBL","season":"2026-27","status":"source_derived_not_officially_reconciled",
         "is_official":False,"elo_approved":False,"source":"ESPN site API, completed finals since NBL27 regular-season opening",
         "season_start":START.isoformat(),"updated_at":datetime.now(timezone.utc).isoformat(),
         "games_replayed":len(valid),"teams":len(TEAMS),"rows":rows,
         "recent_finals":list(reversed(valid[-10:])),
         "source_notice":"Full-season totals calculated independently from ESPN finals. Not yet reconciled against live NBL official standings."}

def main():
    today=datetime.now(timezone.utc).date()
    if today<START:raise ValueError("Season not started")
    candidate=collect(START,today)
    result=build(candidate)
    ledger=Path("data/nbl-research-current-ledger.json")
    ledger.write_text(json.dumps({"season":"2026-27","source_status":"uncertified_source_candidates","games":[g for g in candidate["games"] if g["played_at"][:10]>=START.isoformat()]},indent=2)+"\n")
    dst=Path("data/nbl-standings.json")
    dst.parent.mkdir(parents=True,exist_ok=True)
    dst.write_text(json.dumps(result,indent=2)+"\n")
    print("NBL regular-season standings sourced",result["games_replayed"],"games",result["updated_at"])
if __name__=="__main__":main()

#!/usr/bin/env python3
"""Join prior-season NCAA player opponent exposure to 2026-27 ESPN roster IDs.
Only exact pinned crosswalk IDs and NCAA prior-school identities are allowed.
Descriptive coverage; no unvalidated team rating mutation.
"""
import json,argparse
from collections import Counter
from pathlib import Path
def join(exposure,movement,cross):
    source={}
    duplicate=set()
    for r in exposure["player_exposure"]:
        key=(str(r["historical_player_id"]),str(r.get("historical_team_id","")))
        if key in source:duplicate.add(key)
        source[key]=r
    athletes={str(p["current_id"]):(t["team_id"],p)
              for t in movement["teams"] for p in t["players"]}
    seen=set();matched=[];excluded=Counter()
    for link in cross["links"]:
        eid=str(link["id"])
        if eid in seen:raise ValueError("Duplicate current athlete crosswalk ID")
        seen.add(eid)
        if link.get("method") not in ("name_jersey","last_jersey","name"):
            excluded["fuzzy_or_unapproved"]+=1;continue
        if eid not in athletes:raise ValueError("Crosswalk linked to absent current roster")
        tid,p=athletes[eid]
        prior=str(link.get("prior",""))
        if p.get("prior_school_id")!=prior:
            excluded["historical_school_conflict"]+=1;continue
        key=(str(link.get("pid","")),prior)
        if key in duplicate:excluded["duplicate_historical_identity"]+=1;continue
        r=source.get(key)
        if r is None:excluded["no_opponent_exposure_match"]+=1;continue
        if not isinstance(r.get("opponent_pregame_elo"),(int,float)) or r["minutes"]<=0:
            excluded["invalid_opponent_measure"]+=1;continue
        matched.append({"team_id":tid,"current_player_id":eid,"player":p["player"],
          "prior_school_id":prior,"prior_ncaa_player_id":key[0],
          "minutes":r["minutes"],"opponent_pregame_elo":r["opponent_pregame_elo"]})
    if len({r["current_player_id"] for r in matched})!=len(matched):
        raise ValueError("Repeated player in verified opponent linkage")
    return {"season":"2026-27","status":"RESEARCH_ONLY_OPPONENT_EXPOSURE_LINKAGE",
      "production_elo_changed":False,"source":"data/ncaam-2025-26-opponent-adjusted-player-exposure.json",
      "linked_count":len(matched),"eligible_crosswalk_records":cross["linked_count"],
      "excluded":dict(excluded),"records":matched}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--data",type=Path,default=Path("data"))
    args=ap.parse_args();d=args.data
    def read(x):return json.loads((d/x).read_text())
    out=join(read("ncaam-2025-26-opponent-adjusted-player-exposure.json"),
      read("ncaam-2026-27-player-movement-audit.json"),
      read("ncaam-2026-27-direct-player-crosswalk.json"))
    if out["linked_count"]<1000:raise ValueError("Opponent quality link coverage too low")
    path=d/"ncaam-2026-27-opponent-exposure-links.json"
    path.write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps({k:v for k,v in out.items() if k!="records"},indent=2))
if __name__=="__main__":main()

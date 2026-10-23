#!/usr/bin/env python3
"""Verify 2026->2027 ESPN athlete IDs, then join 2026 NCAA player box by unique school/name.

ESPN IDs are compared ONLY within ESPN. NCAA player box IDs are never treated
as ESPN IDs. Name/school joins remain explicitly provisional, not identity proof.
"""
import argparse,json,re
from pathlib import Path
from collections import defaultdict,Counter
from backtest_ncaam_roster_elo import fetch

def norm(x):return re.sub("[^a-z0-9]","",str(x or "").lower())
def reconcile(old,current,box):
    historical={r["ncaa_id"]:r for r in old["rosters"]}
    prior_by_id=defaultdict(list)
    for school in old["rosters"]:
        for player in school["players"]:
            prior_by_id[str(player["id"])].append((school["ncaa_id"],player))
    prior_box=defaultdict(lambda:defaultdict(set))
    for p in box:
        team="ncaa:"+str(p.get("team_ncaa_team_id") or "")
        pid=str(p.get("player_id") or "")
        name=norm(p.get("clean_name") or p.get("player"))
        if team[5:].isdigit() and pid.isdigit() and name:
            prior_box[team][name].add(pid)
    results=[];counts=Counter()
    for school in current["rosters"]:
        target=school["ncaa_id"]
        for player in school["players"]:
            pid=str(player["id"])
            candidates=prior_by_id.get(pid,[])
            if not candidates:
                counts["new_espn_athlete_id"]+=1;continue
            consistent=[(source,p) for source,p in candidates if norm(p["name"])==norm(player["name"])]
            if len(consistent)!=1 or len(candidates)!=1:
                counts["ambiguous_or_conflicting_espn_id"]+=1;continue
            source,old_player=consistent[0]
            status="verified_espn_returner" if source==target else "verified_espn_d1_transfer"
            counts["verified_espn_continuity"]+=1
            counts[status]+=1
            box_candidates=prior_box[source].get(norm(player["name"]),set())
            state="unique-ncaa-box-candidate" if len(box_candidates)==1 else ("ambiguous-ncaa-box" if box_candidates else "no-ncaa-box")
            counts[state]+=1
            results.append({"team_id":target,"team":school["school"],"prior_team_id":source,
                "player":player["name"],"espn_athlete_id":pid,"espn_status":status,
                "espn_identity_continuity_verified":True,
                "ncaa_box_identity_verified":False,"ncaa_box_status":state,
                "ncaa_box_player_id":next(iter(box_candidates)) if len(box_candidates)==1 else None})
    return {"season":"2026-27","historical_espn_season":2026,
        "teams_current":len(current["rosters"]),"teams_prior":len(old["rosters"]),
        "historical_partial_roster_teams":old.get("partial_roster_teams"),
        "historical_roster_asof_verified":False,
        "identity_release_approved":False,
        "counts":dict(counts),"production_elo_approved":False,
        "limitations":["ESPN identity continuity proves same provider athlete ID across seasons",
            "NCAA player box joins remain school/name candidates, not source-level verified identities",
            "Historical ESPN roster snapshot may include in-season roster changes",
            "No historical as-of timestamp proving preseason availability"],
        "matched":results}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--prior",default="staging/ncaam-2026-roster-evidence.json")
    p.add_argument("--current",default="staging/ncaam-2027-roster-evidence.json")
    p.add_argument("--out",default="data/ncaam-2026-27-espn-identity-continuity.json")
    a=p.parse_args()
    out=reconcile(json.loads(Path(a.prior).read_text()),json.loads(Path(a.current).read_text()),
                  fetch("ncaa_mbb_player_box",2026))
    Path(a.out).write_text(json.dumps(out,separators=(",",":"))+"\n")
    print(json.dumps({"teams_prior":out["teams_prior"],"teams_current":out["teams_current"],
        "counts":out["counts"]},indent=2))
if __name__=="__main__":main()

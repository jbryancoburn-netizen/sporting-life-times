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
    prior_box=defaultdict(lambda:defaultdict(set))
    for p in box:
        team="ncaa:"+str(p.get("team_ncaa_team_id") or "")
        pid=str(p.get("player_id") or "")
        name=norm(p.get("clean_name") or p.get("player"))
        if team[5:].isdigit() and pid.isdigit() and name:
            prior_box[team][name].add(pid)
    results=[];counts=Counter()
    for school in current["rosters"]:
        team=school["ncaa_id"]
        before=historical.get(team)
        if not before:
            counts["missing_prior_espn_roster"]+=len(school["players"])
            continue
        prior_by_id={str(p["id"]):p for p in before["players"]}
        for player in school["players"]:
            pid=str(player["id"]);old_player=prior_by_id.get(pid)
            if not old_player:
                counts["new_espn_athlete_id"]+=1;continue
            if norm(old_player["name"])!=norm(player["name"]):
                counts["same_espn_id_name_conflict"]+=1;continue
            counts["verified_espn_continuity"]+=1
            candidates=prior_box[team].get(norm(player["name"]),set())
            state="unique-ncaa-box-candidate" if len(candidates)==1 else ("ambiguous-ncaa-box" if candidates else "no-ncaa-box")
            counts[state]+=1
            results.append({"team_id":team,"team":school["school"],"player":player["name"],
                "espn_athlete_id":pid,"espn_identity_continuity_verified":True,
                "ncaa_box_identity_verified":False,"ncaa_box_status":state,
                "ncaa_box_player_id":next(iter(candidates)) if len(candidates)==1 else None})
    return {"season":"2026-27","historical_espn_season":2026,
        "teams_current":len(current["rosters"]),"teams_prior":len(old["rosters"]),
        "counts":dict(counts),"production_elo_approved":False,
        "limitations":["ESPN identity continuity proves same provider athlete ID across seasons",
            "NCAA player box joins remain school/name candidates, not source-level verified identities",
            "Historical ESPN roster snapshot may include in-season roster changes"],
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

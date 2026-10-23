#!/usr/bin/env python3
"""Reconcile ALL 365 NCAA teams' movement candidates without guessing identities.

Flags suspicious prior-school assignments and produces a bounded, sortable
verification queue. A candidate is not a verified player or an Elo input.
"""
import json,argparse
from pathlib import Path
from collections import Counter,defaultdict
def reconcile(movement,registry):
    teams=movement["teams"]
    by_id={x["id"]:x for x in registry["teams"]}
    if len(teams)!=365 or len(by_id)!=365:raise ValueError("Expected 365 programs")
    audit=[];issues=[]
    global_ids=defaultdict(list)
    for t in teams:
        uid=t["team_id"]
        if uid not in by_id:raise ValueError("Unknown team "+uid)
        counts=Counter(p["status"] for p in t["players"])
        n=len(t["players"])
        ret=counts["unique-name-returner-candidate"]
        incoming=counts["unique-name-transfer-candidate"]
        unknown=n-ret-incoming
        reasons=[]
        if n<8:reasons.append("insufficient_roster")
        if unknown/n>.65:reasons.append("majority_unresolved")
        if incoming/n>.6:reasons.append("unusually_high_transfer_share")
        if ret==0:reasons.append("no_prior_returner_candidates")
        if incoming>0 and ret==0:reasons.append("transfer_heavy_no_returners")
        if any(p["status"]=="id-not-found-name-ambiguous" for p in t["players"]):reasons.append("ambiguous_name_identity")
        for p in t["players"]:
            global_ids[p["current_id"]].append((uid,p["player"]))
            if p["status"]=="unique-name-transfer-candidate" and p.get("prior_school_id")==uid:
                reasons.append("self_transfer_identity_error")
            if p["status"]=="unique-name-returner-candidate" and p.get("prior_school_id")!=uid:
                reasons.append("returner_school_identity_error")
        priority=100*(unknown/n)+25*bool(incoming/n>.6)+25*bool(ret==0)+20*bool("ambiguous_name_identity" in reasons)
        record={"team_id":uid,"team":t["team"],"roster_players":n,
          "returner_candidates":ret,"incoming_d1_candidates":incoming,
          "unresolved":unknown,"unresolved_share":round(unknown/n,4),
          "priority_score":round(priority,2),"flags":sorted(set(reasons)),
          "identity_verified":False,"reviewed_for_internal_consistency":True}
        audit.append(record)
        if reasons:issues.append(record)
    duplicate_current_ids={pid:places for pid,places in global_ids.items() if len(places)>1}
    audit.sort(key=lambda x:(-x["priority_score"],x["team"]))
    return {"season":"2026-27","teams_checked":len(audit),
      "teams_with_flags":len(issues),
      "current_player_id_duplicates_across_rosters":duplicate_current_ids,
      "identity_verified_players":0,"eligible_for_transfer_elo":False,
      "status":"reconciliation-screen-complete; external identity verification required",
      "notes":["All candidate matches require source-level identity confirmation",
        "Unresolved does not imply freshman; D2, overseas, alias and missing data possible",
        "Flags identify review priority, not proof of incorrect roster"],
      "team_audit":audit}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--movement",type=Path,default=Path("data/ncaam-2026-27-player-movement-audit.json"))
    p.add_argument("--registry",type=Path,default=Path("data/ncaam-2026-27-team-registry.json"))
    p.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-identity-reconciliation.json"))
    a=p.parse_args()
    x=reconcile(json.loads(a.movement.read_text()),json.loads(a.registry.read_text()))
    a.out.write_text(json.dumps(x,indent=2)+chr(10))
    print(json.dumps({"teams_checked":x["teams_checked"],"teams_with_flags":x["teams_with_flags"],
      "duplicate_current_ids":len(x["current_player_id_duplicates_across_rosters"]),
      "top_review_queue":x["team_audit"][:10]},indent=2))
if __name__=="__main__":main()

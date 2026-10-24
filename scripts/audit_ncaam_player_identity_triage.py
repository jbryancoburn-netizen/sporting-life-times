#!/usr/bin/env python3
"""Reconcile NCAA/ESPN player identity evidence without fabricating matches.

Separates a missing prior Division I box from an actual prior-school conflict.
Writes actionable case records and preserves the 2,923 locked reliable links.
"""
import argparse,json
from collections import Counter
from pathlib import Path

def analyze(movement,crosswalk):
    people={}
    for team in movement["teams"]:
        for p in team["players"]:
            pid=str(p["current_id"])
            if pid in people:raise ValueError("Duplicate current player: "+pid)
            people[pid]=(team,p)
    if len(people)!=movement["players_audited"]:raise ValueError("Roster player count mismatch")
    source_seen=set()
    categories=Counter()
    flagged=[]
    for entry in crosswalk["links"]:
        eid=str(entry["id"])
        if eid in source_seen or eid not in people:raise ValueError("Repeated or unknown crosswalk athlete: "+eid)
        source_seen.add(eid)
        school,p=people[eid]
        method=entry["method"]
        prev=p.get("prior_school_id")
        linked=entry.get("prior")
        minutes=p.get("prior_minutes")
        if method=="jaro_winkler":
            category="fuzzy_identity_excluded"
        elif method not in ("name_jersey","name","last_jersey"):
            raise ValueError("Unapproved player identity method")
        elif not prev:
            category="no_prior_d1_box"
        elif prev!=linked:
            category="actual_prior_school_conflict"
        elif not isinstance(minutes,(int,float)) or minutes<=0:
            category="missing_valid_prior_minutes"
        else:
            category="accepted_prior_production"
        categories[category]+=1
        if category not in ("accepted_prior_production","no_prior_d1_box"):
            flagged.append({"category":category,"current_player_id":eid,
                "historical_player_id":str(entry.get("pid","")),
                "player":p["player"],"2026_27_team":school["team"],
                "2026_27_team_id":school["team_id"],"roster_reported_prior_school_id":prev,
                "crosswalk_prior_school_id":linked,"prior_minutes":minutes,
                "matching_method":method,"release_action":"EXCLUDE_PENDING_DOCUMENTARY_VERIFICATION"})
    categories["unlinked_current_roster_player"]=len(people)-len(source_seen)
    categories["missing_valid_prior_minutes"]+=0
    expected={"accepted_prior_production":2923,"no_prior_d1_box":587,
              "actual_prior_school_conflict":7,"fuzzy_identity_excluded":6,
              "missing_valid_prior_minutes":0,"unlinked_current_roster_player":2014}
    if dict(categories)!=expected:raise ValueError("Source counts changed; must re-audit before updating rankings: "+str(categories))
    if len(source_seen)!=crosswalk["linked_count"]:raise ValueError("Crosswalk count mismatch")
    flagged.sort(key=lambda x:(x["category"],x["2026_27_team"],x["player"]))
    return {
        "season":"2026-27","source":"NCAA-origin 2025-26 historical box + ESPN 2026-27 roster + pinned crosswalk",
        "interpretation":"Missing historical Division I game box data is not proof a transfer, freshman, or invalid identity. No player is automatically accepted using names alone.",
        "model_mutation":False,"production_elo_changed":False,
        "numbers":dict(categories),
        "linked_player_count":len(source_seen),
        "total_roster_players":len(people),
        "confirmed_prior_school_disagreements":categories["actual_prior_school_conflict"],
        "remaining_document_verification_cases":len(flagged),
        "flagged_cases":flagged}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--movement",type=Path,default=Path("data/ncaam-2026-27-player-movement-audit.json"))
    p.add_argument("--crosswalk",type=Path,default=Path("data/ncaam-2026-27-direct-player-crosswalk.json"))
    p.add_argument("--output",type=Path,default=Path("data/ncaam-2026-27-player-identity-triage.json"))
    args=p.parse_args()
    result=analyze(json.loads(args.movement.read_text()),json.loads(args.crosswalk.read_text()))
    args.output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"numbers":result["numbers"],"cases":result["remaining_document_verification_cases"]},indent=2))
if __name__=="__main__":
    main()

#!/usr/bin/env python3
"""Link institutional school-history evidence to 2025-26 NCAA player-box identities.

The join uses athlete name + independent institutional prior-school evidence +
the NCAA's prior-season team ID. An NCAA numeric player ID is not assumed
equivalent to the current ESPN ID. Reject ambiguous NCAA joins and never guess.
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

def normalized(value):
    return re.sub(r'[^a-z0-9]', '', str(value or '').lower())

def historical_index(rows):
    entries = defaultdict(lambda:defaultdict(lambda:{
        "contest_ids":set(), "minutes":0., "points":0., "rows":0}))
    for row in rows:
        team=str(row.get("team_ncaa_team_id") or "").strip()
        pid=str(row.get("player_id") or "").strip()
        name=normalized(row.get("clean_name") or row.get("player"))
        contest=str(row.get("contest_id") or "").strip()
        if not team.isdigit() or not pid.isdigit() or not name or not contest:
            continue
        try:
            minutes=float(row.get("mins") or 0)
            points=float(row.get("pts") or 0)
        except (ValueError, TypeError):
            continue
        if not (0<=minutes<=75 and 0<=points<=125):
            continue
        item=entries[("ncaa:"+team,name)][pid]
        if contest in item["contest_ids"]:
            raise ValueError("Duplicate source contest/player for NCAA player "+pid)
        item["contest_ids"].add(contest)
        item["minutes"]+=minutes
        item["points"]+=points
        item["rows"]+=1
    return entries

def link(evidence, history, valid_teams=None):
    if evidence.get("teams_checked")!=365:
        raise ValueError("Expect complete 365-school reconciliation")
    records=evidence.get("records",[])
    if evidence.get("uncorroborated_ambiguous_count") or len(records)!=evidence.get("institutional_source_confirmations"):
        raise ValueError("Incomplete official school history evidence")
    ix=historical_index(history)
    matched=[];unlinked=[];newcomers=[];seen=set()
    for p in records:
        eid=str(p.get("espn_athlete_id",""))
        if not eid or eid in seen:
            raise ValueError("Missing or duplicate current ESPN athlete ID")
        seen.add(eid)
        if p.get("historical_ncaa_box_match_verified") or p.get("historical_ncaa_player_id"):
            raise ValueError("Expected no preexisting assumed NCAA player link")
        classification=p["category"]
        prev=p["prior_team_id"]
        if classification=="new-to-d1":
            if prev is not None:raise ValueError("New to D-I player may not specify NCAA prior school")
            newcomers.append({"espn_athlete_id":eid,"player":p["player"],
                              "team_id":p["team_id"],"status":"no_asserted_prior_d1_player",
                              "institutional_source":p["institutional_source"]})
            continue
        if classification not in ("transfer","returner") or not isinstance(prev,str):
            raise ValueError("Invalid candidate prior school")
        if valid_teams is not None and prev not in valid_teams:
            raise ValueError("Prior school not in canonical NCAA registry: "+prev)
        candidates=ix.get((prev,normalized(p["player"])),{})
        if len(candidates)!=1:
            unlinked.append({"espn_athlete_id":eid,"player":p["player"],
                             "current_team_id":p["team_id"],
                             "prior_team_id":prev,
                             "status":"no_ncaa_box_record" if not candidates else "multiple_prior_ncaa_players",
                             "candidate_player_ids":len(candidates)})
            continue
        pid,record=next(iter(candidates.items()))
        if record["minutes"]<0 or len(record["contest_ids"])==0:
            raise ValueError("Invalid historical player production")
        matched.append({
            "espn_athlete_id":eid,
            "player":p["player"],
            "current_team_id":p["team_id"],
            "prior_team_id":prev,
            "classification":classification,
            "historical_ncaa_player_id":pid,
            "historical_season":"2025-26",
            "prior_games":len(record["contest_ids"]),
            "prior_minutes":round(record["minutes"],2),
            "prior_points":round(record["points"],2),
            "identity_basis":"institutional school history + unique NCAA prior-school/name player-box join",
            "institutional_source":p["institutional_source"],
            "historical_stat_source":"SportsDataverse mirror of NCAA-origin ncaa_mbb_player_box_2026.csv.gz",
            "cross_provider_numeric_id_equivalence_claimed":False,
            "direct_cross_provider_id_match":False
        })
    matched.sort(key=lambda p:(p["current_team_id"],p["player"],p["espn_athlete_id"]))
    unlinked.sort(key=lambda p:(p["current_team_id"],p["player"],p["espn_athlete_id"]))
    return {
        "season":"2026-27", "historical_season":"2025-26",
        "source_candidate_count":len(records),
        "source_correlated_ncaa_player_matches":len(matched),
        "source_correlated_returners":sum(x["classification"]=="returner" for x in matched),
        "source_correlated_transfers":sum(x["classification"]=="transfer" for x in matched),
        "new_to_d1_no_box_expected":len(newcomers),
        "uncertain_historical_identity_count":len(unlinked),
        "complete_classification_accounting":len(matched)+len(unlinked)+len(newcomers)==len(records),
        "exact_numeric_id_cross_provider_matches":0,
        "approved_for_primary":False,
        "note":"Source-correlated matches link independent school biographical evidence to uniquely identified NCAA-origin historical box records. No cross-provider ID equivalence; retrospective eligibility requires a separate production validation.",
        "matched":matched,"unlinked":unlinked,"newcomers":newcomers
    }

def main():
    from backtest_ncaam_roster_elo import fetch
    p=argparse.ArgumentParser()
    p.add_argument("--identity",type=Path,default=Path("data/ncaam-2026-27-identity-resolved.json"))
    p.add_argument("--registry",type=Path,default=Path("data/ncaam-2026-27-team-registry.json"))
    p.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-historical-athlete-links.json"))
    args=p.parse_args()
    evidence=json.loads(args.identity.read_text(encoding="utf-8"))
    registry=json.loads(args.registry.read_text(encoding="utf-8"))
    valid={x["id"] for x in registry["teams"]}
    result=link(evidence,fetch("ncaa_mbb_player_box",2026),valid)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({k:result[k] for k in
                      ("source_candidate_count","source_correlated_ncaa_player_matches",
                       "uncertain_historical_identity_count","new_to_d1_no_box_expected",
                       "approved_for_primary")},indent=2))
    if not result["complete_classification_accounting"]:
        raise SystemExit("Incomplete NCAA historical player evidence accounting")

if __name__=="__main__": main()

#!/usr/bin/env python3
"""Evidence-first NCAA player coverage queue; NEVER infer an unsupported transfer.

Provides an auditable player-by-player explanation for the 2026-27
preseason roster's unmeasured historical production, with highest-impact
source retrieval priorities. No rating or existing player ID is changed.
"""
import argparse,json,math
from collections import Counter,defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent/"data"
def read(p):return json.loads(p.read_text(encoding="utf8"))
def build(movement,crosswalk,minutes,source_review,ratings):
    if movement["players_audited"]!=5537 or len(movement["teams"])!=365:raise ValueError("Roster universe changed")
    links={str(x["id"]):x for x in crosswalk["links"]}
    unlinked=set(map(str,crosswalk["unlinked_espn_ids"]))
    if len(links)!=3523 or len(unlinked)!=2014 or links.keys() & unlinked:
        raise ValueError("Link universe broken")
    neg={str(x["current_espn_id"]) for x in source_review["officially_disambiguated_exclusions"]}
    prior={str(x["current_espn_id"]) for x in source_review["officially_corroborated_prior_schools_only"]}
    ambiguities={str(x["current_espn_id"]) for x in source_review["officially_reviewed_ambiguous_no_prior_d1"]}
    if len(neg)!=22 or len(prior)!=4 or len(ambiguities)!=4:raise ValueError("Source identity review changed")
    rated={r["team_id"]:r for r in ratings["rankings"]}
    prev={x["team_id"]:float(x["prior_minutes"]) for x in minutes["teams"]}
    if len(rated)!=365 or len(prev)!=365:raise ValueError("Team registry changed")
    result=[];teams=[];used=set();status=Counter();per_source=Counter()
    for school in movement["teams"]:
        tid=school["team_id"];denom=prev[tid];team_unmeasured=0;tm=Counter()
        for person in school["players"]:
            id_=str(person["current_id"])
            if id_ in used:raise ValueError("Duplicate athlete: "+id_)
            used.add(id_)
            link=links.get(id_)
            prior_school=person.get("prior_school_id")
            mins=person.get("prior_minutes")
            valid_minutes=isinstance(mins,(int,float)) and math.isfinite(mins) and mins>0
            if link:
                method=link["method"]
                if method=="jaro_winkler":
                    category="linked_fuzzy_excluded"
                elif method not in ("name_jersey","name","last_jersey"):
                    raise ValueError("Unreviewed crosswalk method")
                elif prior_school!=link["prior"]:
                    category="linked_prior_school_conflict"
                elif not valid_minutes:
                    category="linked_missing_prior_minutes"
                else:
                    category="measured_and_counted"
            elif id_ in neg:category="officially_excluded_false_identity"
            elif id_ in prior:category="officially_confirmed_prior_school_no_player_id"
            elif id_ in ambiguities:category="officially_reviewed_non_d1_no_player_id"
            elif person["status"]=="no-prior-d1-box":category="unlinked_no_prior_d1_box"
            else:raise ValueError("Unreviewed unlinked transfer candidate: "+id_)
            status[category]+=1
            if category=="measured_and_counted":continue
            potential=round(160*min(1.5,float(mins)/denom),2) if valid_minutes and denom>=1000 else 0.0
            item={"player":person["player"],"current_espn_id":id_,"team":school["team"],
                  "team_id":tid,"classification":category,"current_roster_status":person["status"],
                  "crosswalk_method":link["method"] if link else None,
                  "linked_ncaa_player_id":str(link["pid"]) if link else None,
                  "crosswalk_prior_school_id":link["prior"] if link else None,
                  "name_candidate_prior_school_id":prior_school,
                  "name_candidate_prior_minutes":float(mins) if valid_minutes else None,
                  "hypothetical_false_link_transfer_points":potential,
                  "production_eligible":False,
                  "next_evidence":(
                     "Resolve NCAA player ID and prior-school conflict; require source-verified player identity" if category=="linked_prior_school_conflict" else
                     "Find source-backed 2025–26 NCAA player box record for this confirmed link" if category=="linked_missing_prior_minutes" else
                     "Verify player ID without fuzzy name-only matching" if category=="linked_fuzzy_excluded" else
                     "Find direct current ESPN ID to previous NCAA player ID, not just prior school" if category=="officially_confirmed_prior_school_no_player_id" else
                     "No prior D-I production may be assigned from identical name" if category.startswith("officially_") else
                     "Determine current roster entrant status, then retrieve independent eligible prior-season data if any")}
            result.append(item);team_unmeasured+=1;tm[category]+=1
        teams.append({"team":school["team"],"team_id":tid,"total_roster":len(school["players"]),
            "unmeasured_players":team_unmeasured,"covered_players":len(school["players"])-team_unmeasured,
            "unmeasured_share":round(team_unmeasured/len(school["players"]),4),
            "previous_team_minutes":denom,
            "source_priority":round(team_unmeasured/len(school["players"])*100+
                     3*tm["linked_prior_school_conflict"]+2*tm["linked_missing_prior_minutes"],2),
            "case_counts":dict(sorted(tm.items()))})
    if len(used)!=5537 or sum(status.values())!=5537:
        raise ValueError("Players dropped")
    if status["measured_and_counted"]!=2923:
        raise ValueError("Published preseason linked+measured count disagrees")
    if set(used)!=set(links)|unlinked:raise ValueError("Roster/source crosswalk mismatch")
    teams.sort(key=lambda x:(-x["source_priority"],x["team"]))
    order={"linked_prior_school_conflict":0,"linked_missing_prior_minutes":1,
           "linked_fuzzy_excluded":2,"officially_confirmed_prior_school_no_player_id":3,
           "unlinked_no_prior_d1_box":4,"officially_reviewed_non_d1_no_player_id":5,
           "officially_excluded_false_identity":6}
    result.sort(key=lambda x:(order[x["classification"]],-x["hypothetical_false_link_transfer_points"],x["team"],x["player"]))
    return {"season":"2026-27","status":"PLAYER_SOURCE_COVERAGE_AUDIT_NONPROMOTABLE",
       "model_ratings_modified":False,"unverified_production_added":0,
       "team_count":365,"roster_players":5537,"players_with_measured_prior_stats":2923,
       "players_without_eligible_prior_stats":len(result),
       "reason_counts":dict(sorted(status.items())),
       "safety_note":"Potential Elo changes are counterfactual ONLY and are never applied. Do not automatically classify unknown origins as transfers.",
       "priority":"First recover missing statistics for strong current-to-prior athlete links; then independently verify unresolved D-I athlete identities.",
       "team_priority":teams,"player_review_queue":result}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",type=Path,default=ROOT)
    p.add_argument("--out",type=Path,default=ROOT/"ncaam-2026-27-player-coverage-review-queue.json")
    p.add_argument("--verify",action="store_true")
    a=p.parse_args()
    names=["ncaam-2026-27-player-movement-audit.json",
           "ncaam-2026-27-direct-player-crosswalk.json",
           "ncaam-2026-27-minutes-retention-audit.json",
           "ncaam-2026-27-player-identity-source-review.json",
           "ncaam-2026-27-preseason-roster-informed.json"]
    model=build(*(read(a.root/n) for n in names))
    output=json.dumps(model,indent=2,ensure_ascii=False)+"\n"
    if a.verify:
        if a.out.read_text(encoding="utf8")!=output:
            raise SystemExit("FAIL: historical player coverage queue doesn't reproduce")
        print("PASS: unreconciled NCAA player evidence source queue reproduces")
    else:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(output,encoding="utf8")
        print(json.dumps({"total":model["roster_players"],"measured":model["players_with_measured_prior_stats"],
            "unmeasured":model["players_without_eligible_prior_stats"],
            "reasons":model["reason_counts"],"highest_review_schools":model["team_priority"][:10]},indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""2026–27 NCAA negative player-identity audit.

A unique full name is NOT a unique student athlete. Some 2026 freshmen, junior-college and Division II players share names with
experienced 2025–26 D-I players. Protect preseason Elo from a future false
name-only match, and classify four independently corroborated D-I origins
without mistakenly granting them unseen historical NCAA athlete IDs.

Source facts come from school roster biographies/official news, pinned by URL
in a separate reviewed negative-identity manifest. This script validates
identity exclusions against the existing immutable 2026–27 roster and
pinned NCAA/ESPN ID crosswalk. It DOES NOT create positive player matches.
"""
import argparse
import json
import math
from collections import Counter,defaultdict
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parent.parent/"data"
OFFICIAL_HOSTS={
    "Duke":{"goduke.com"},
    "Kansas":{"kuathletics.com"},
    "Michigan":{"mgoblue.com"},
    "South Fla.":{"gousfbulls.com"},
    "Southern Utah":{"suutbirds.com"},
    "Syracuse":{"cuse.com"},
    "The Citadel":{"citadelsports.com"},
    "UMass Lowell":{"goriverhawks.com"},
    "La Salle":{"goexplorers.com"},
    "UMES":{"umeshawksports.com"},
    "Manhattan":{"gojaspers.com"},
    "Western Mich.":{"wmubroncos.com"},
    "UC San Diego":{"ucsdtritons.com"},
    "Montana":{"gogriz.com"},
    "UAlbany":{"ualbanysports.com"},
    "FIU":{"fiusports.com"},
    "Longwood":{"longwoodlancers.com"},
    "Texas Tech":{"texastech.com"},
    "Illinois St.":{"goredbirds.com"},
    "Illinois":{"fightingillini.com"},
    "South Carolina":{"gamecocksonline.com"},
    "Akron":{"gozips.com"},
    "Old Dominion":{"odusports.com"},
    "Wake Forest":{"godeacs.com"},
    "Massachusetts":{"umassathletics.com"},
    "Wright St.":{"wsuraiders.com"},
}
SECONDARY_HOSTS={"uclabruins.com","gocamels.com","umassathletics.com","goshockers.com",
                 "goexplorers.com","saintanselmhawks.com","gogriz.com"}
def stable_json(doc):
    return json.dumps(doc,indent=2,ensure_ascii=False)+"\n"
def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))
def verify(movement,crosswalk,minutes,negatives,ratings,positives):
    teams=movement.get("teams",[])
    if len(teams)!=365 or movement.get("players_audited")!=5537:
        raise ValueError("Roster participant count changed")
    if crosswalk.get("linked_count")!=3523 or crosswalk.get("unlinked_count")!=2014:
        raise ValueError("Pinned crosswalk coverage changed; recalibrate audit")
    roster={}
    by_name=defaultdict(list)
    for t in teams:
        for p in t["players"]:
            pid=str(p["current_id"])
            if pid in roster:raise ValueError("ESPN athlete ID appears on multiple rosters: "+pid)
            roster[pid]={**p,"team":t["team"],"team_id":t["team_id"]}
            by_name[p["player"].casefold()].append(pid)
    if len(roster)!=5537:raise ValueError("Incomplete roster")
    links={}
    prior_athletes=defaultdict(list)
    counts=Counter()
    for link in crosswalk.get("links",[]):
        pid=str(link["id"])
        if pid in links or pid not in roster:
            raise ValueError("Repeated or absent linked athlete ID: "+pid)
        links[pid]=link
        if not str(link["pid"]).isdigit():raise ValueError("NCAA historical player ID invalid")
        prior_athletes[str(link["pid"])].append(pid)
        counts[link["method"]]+=1
    if len(links)!=3523 or any(len(v)>1 for v in prior_athletes.values()):
        raise ValueError("One 2025-26 NCAA player credited to multiple current athletes")
    unlinked=set(str(p) for p in crosswalk["unlinked_espn_ids"])
    if len(unlinked)!=2014 or (unlinked & set(links)) or (unlinked | set(links))!=set(roster):
        raise ValueError("Unlinked ESPN athletes do not partition full 365-team roster")
    denominators={t["team_id"]:float(t["prior_minutes"]) for t in minutes["teams"]}
    if len(denominators)!=365:raise ValueError("Historic team minutes not complete")
    current_ratings={r["team_id"]:r for r in ratings["rankings"]}
    if len(current_ratings)!=365:raise ValueError("Incomplete rated team universe")

    if (negatives.get("season")!="2026-27" or
        negatives.get("status")!="school_source_verified_negative_identity_exclusions" or
        negatives.get("automatically_promote_players") is not False or
        negatives.get("authoritative_for_positive_identity_linking") is not False):
        raise ValueError("Negative identity source file is not approved for this protection")
    exclusions={}
    for row in negatives["records"]:
        pid=str(row["current_espn_id"])
        person=roster.get(pid)
        if pid in exclusions or not person or person["player"]!=row["player"] or person["team"]!=row["school"]:
            raise ValueError("Adjudicated current athlete missing or moved: "+pid)
        if row["decision"]!="exclude_prior_d1_name_only":
            raise ValueError("Exclusion unexpectedly authorizes a player match")
        if person["status"]!="unique-name-transfer-candidate" or not person.get("prior_school_id"):
            raise ValueError("Official-source negative identity no longer has erroneous old-name candidate")
        if person["prior_minutes"]<=0 or pid not in unlinked or pid in links:
            raise ValueError("Prior minutes for OFFICIALLY DIFFERENT athlete must never enter Elo: "+pid)
        school_hosts=OFFICIAL_HOSTS.get(person["team"],set())
        link=urlsplit(row.get("school_source_url",""))
        if link.scheme!="https" or link.hostname not in school_hosts:
            raise ValueError("Current-school primary roster source missing or not official")
        if row.get("contrasting_source_url"):
            other=urlsplit(row["contrasting_source_url"])
            if other.scheme!="https" or other.hostname not in SECONDARY_HOSTS:
                raise ValueError("Unrecognized independent contrasting official athlete source")
        if not row.get("reason") or not row.get("evidence_kind"):
            raise ValueError("Missing source-specific independent player identification rationale")
        old_minutes=float(person["prior_minutes"])
        team_minutes=denominators[person["team_id"]]
        if team_minutes<=1000:raise ValueError("No old-school minutes normalization for this source")
        # Counterfactual, NOT present in official preseason rating:
        # If someone treated a false matched-name as a transfer, the model's
        # transfer coefficient would add roughly this many Elo points.
        hypothetical=160.0*min(1.5,old_minutes/team_minutes)
        others=[{"current_espn_id":other_id,"team":roster[other_id]["team"],
                 "linked_to_historical":other_id in links}
                for other_id in by_name[person["player"].casefold()] if other_id!=pid]
        exclusions[pid]={**row,
            "erroneously_suggested_prior_school_id":person["prior_school_id"],
            "incorrect_prior_minutes_if_name_reused":round(old_minutes,2),
            "incorrect_prior_points_if_name_reused":person.get("prior_points"),
            "estimated_avoided_false_transfer_elo_if_mislinked":round(hypothetical,2),
            "actually_used_by_official_or_experimental_elo":False,
            "identically_named_other_current_roster_athletes":others}

    if (positives.get("season")!="2026-27" or
        positives.get("status")!="official_prior_school_corroborated_player_identity_id_unlinked" or
        positives.get("production_elo_approved") is not False or
        positives.get("unique_prior_athlete_id_proven") is not False or
        positives.get("automatic_elo_linking_authorized") is not False):
        raise ValueError("Prior-school corroborations must not authorize player identity or primary Elo")
    origin_confirmed={}
    for row in positives["records"]:
        pid=str(row["current_espn_id"])
        person=roster.get(pid)
        if pid in origin_confirmed or pid in exclusions or pid in links or pid not in unlinked:
            raise ValueError("Cannot create duplicate/automatic crosswalk athlete from prior-school corroboration: "+pid)
        if not person or person["team"]!=row["school"] or person["player"]!=row["player"]:
            raise ValueError("Prior-school source mismatch to current player roster")
        if (person["status"]!="unique-name-transfer-candidate" or
            person.get("prior_school_id")!=row.get("prior_school_id") or
            not isinstance(person.get("prior_minutes"),(int,float)) or
            person["prior_minutes"]<=0):
            raise ValueError("Official prior-school document does not corroborate the old NCAA-origin candidate")
        url=urlsplit(row.get("source_url",""))
        if url.scheme!="https" or url.hostname not in OFFICIAL_HOSTS.get(person["team"],set()):
            raise ValueError("Prior-school corroboration is not an official destination-school athletics page")
        if not row.get("source_statement") or not row.get("verified_prior_school"):
            raise ValueError("Missing source-specific official prior-school claim")
        origin_confirmed[pid]={**row,
            "source_name_matched_historical_minutes":round(person["prior_minutes"],2),
            "source_name_matched_historical_points":person.get("prior_points"),
            "historical_ncaa_player_id_verified":False,
            "eligible_for_elo":False,
            "next_evidence_required":"Independent current ESPN athlete ID to prior NCAA athlete ID proof; school-name match alone is not proof"}
    statuses=Counter()
    ranked=[]
    for pid in sorted(unlinked):
        person=roster[pid]
        statuses[person["status"]]+=1
        if pid in exclusions or pid in origin_confirmed:continue
        if person["status"] not in ("unique-name-transfer-candidate","id-not-found-name-ambiguous"):
            continue
        possible_minutes=person.get("prior_minutes") or 0.0
        denominator=denominators[person["team_id"]]
        # REVIEW PRIORITY only; this would be incorrect to use for Elo.
        potential=160*min(1.5,possible_minutes/denominator) if denominator>0 else 0.0
        ranked.append({
            "current_espn_id":pid,"player":person["player"],"team":person["team"],
            "team_id":person["team_id"],"unverified_candidate_type":person["status"],
            "name_matched_prior_school_id":person.get("prior_school_id"),
            "name_matched_prior_minutes":possible_minutes or None,
            "potential_false_transfer_elo_if_naively_matched":round(potential,2),
            "review_reason":"source-level player identity must be confirmed; do not use candidate production",
            "eligible_for_elo":False})
    ranked.sort(key=lambda r:(-r["potential_false_transfer_elo_if_naively_matched"],r["team"],r["player"]))
    if len(exclusions)!=22 or len(origin_confirmed)!=4 or len(ranked)!=4 or statuses["unique-name-transfer-candidate"]!=26 or statuses["id-not-found-name-ambiguous"]!=4:
        raise ValueError("Unexpected vetted exclusions or unmatched transfer review workload")
    unlinked_no_prior=statuses["no-prior-d1-box"]
    summary={
        "all_current_roster_players":len(roster),
        "all_teams":len(teams),
        "source_linked_athletes":len(links),
        "source_unlinked_athletes":len(unlinked),
        "strong_name_or_jersey_crosswalk":crosswalk["strong_count"],
        "linked_but_not_enough_verified_player_stats":ratings["evidence"]["strong_id_players_missing_verified_minutes"],
        "source_unlinked_unique_name_transfer_candidates":statuses["unique-name-transfer-candidate"],
        "source_unlinked_ambiguous_name_cases":statuses["id-not-found-name-ambiguous"],
        "source_unlinked_without_prior_d1_box":unlinked_no_prior,
        "school_officially_rejected_false_prior_player_links":len(exclusions),
        "prior_d1_schools_confirmed_but_current_to_old_athlete_id_unlinked":len(origin_confirmed),
        "unresolved_unique_name_d1_transfer_candidates_after_school_review":
            statuses["unique-name-transfer-candidate"]-len(exclusions)-len(origin_confirmed),
        "open_high_priority_candidate_links":len(ranked),
        "unlinked_players_remaining_without_approved_prior_history":len(unlinked),
        "negative_identity_cases_separately_flagged":len(exclusions),
        "incorrect_prior_d1_minutes_in_negative_name_candidates":round(sum(x["incorrect_prior_minutes_if_name_reused"] for x in exclusions.values()),2),
        "hypothetical_elo_points_not_added_by_invalid_matches":round(sum(x["estimated_avoided_false_transfer_elo_if_mislinked"] for x in exclusions.values()),2),
        "prior_player_ids_credited_to_multiple_current_athletes":0,
        "crosswalk_method_counts":dict(sorted(counts.items()))
    }
    if sum(statuses.values())!=len(unlinked):
        raise ValueError("Missing or duplicated category")
    return {
        "season":"2026-27","status":"negative_identity_protection_and_review_queue_not_primary_release",
        "production_elo_approved":False,
        "purpose":"Prevent unsupported named-player transfer production from being promoted, keep historical player identities unique, prioritize remaining unresolved cases",
        "counterfactual_warning":"All avoided Elo increments are only hypothetical if the current model were to credit unsupported name candidates. No eight negative candidates were credited any prior production in the published model.",
        "source":"Pinned current 2026-27 ESPN athlete IDs; 2025-26 NCAA player stat ledger; official university roster pages",
        "summary":summary,
        "officially_disambiguated_exclusions":sorted(exclusions.values(),key=lambda r:-r["estimated_avoided_false_transfer_elo_if_mislinked"]),
        "officially_corroborated_prior_schools_only":sorted(origin_confirmed.values(),key=lambda r:r["school"]),
        "high_priority_positive_identity_review_queue":ranked,
        "model_policy":{
            "do_not_auto_attach_old_stats_by_name":True,
            "confirm_prior_school_does_not_suffice_to_link_athlete_ID":True,
            "excluded_negative_ids_must_remain_unlinked":True,
            "unresolved_names_require_independent_school_and_player_identity_evidence":True,
            "do_not_recalculate_primary_elo_from_this_review":True}}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",type=Path,default=ROOT)
    ap.add_argument("--output",type=Path,default=ROOT/"ncaam-2026-27-player-identity-source-review.json")
    ap.add_argument("--verify",action="store_true")
    args=ap.parse_args()
    paths=["ncaam-2026-27-player-movement-audit.json",
           "ncaam-2026-27-direct-player-crosswalk.json",
           "ncaam-2026-27-minutes-retention-audit.json",
           "ncaam-2026-27-official-negative-player-identities.json",
           "ncaam-2026-27-preseason-roster-informed.json",
           "ncaam-2026-27-official-prior-school-corroborations.json"]
    result=verify(*(read_json(args.root/p) for p in paths))
    actual=stable_json(result)
    if args.verify:
        if not args.output.exists() or args.output.read_text(encoding="utf-8")!=actual:
            raise SystemExit("FAIL: official-player-identity review report does not reproduce")
        print("PASS: verified 22 false name collisions, 4 prior-school-only cases, and 4 ambiguous identities")
    else:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(actual,encoding="utf-8")
        print(json.dumps(result["summary"],indent=2))
if __name__=="__main__":main()

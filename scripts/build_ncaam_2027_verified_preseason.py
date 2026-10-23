#!/usr/bin/env python3
"""Build a reproducible 365-team 2026-27 identity-linked preseason Elo edition.

Only strong pinned NCAA/ESPN ID links paired with NCAA-origin prior minutes
from the player-movement audit enter roster adjustments. No name-only candidate,
unobserved prior minutes, fuzzy ID link, or fabricated newcomer value is used.
The original preseason rating remains the fallback for uncovered programs.
The calibrated two-feature coefficients are inherited from the LOCKED 2026
holdout; model is labeled provisional due to retrospective roster limitations.
"""
import argparse
import json
import math
from pathlib import Path

def median_high(values):
    ordered=sorted(values)
    if not ordered:
        raise ValueError("Missing roster features")
    return ordered[len(ordered)//2]

def build(baseline, registry, movement, minutes_report, crosswalk, validation):
    if (baseline.get("season")!="2026-27" or
        len(baseline.get("rankings",[]))!=365 or
        len(registry.get("teams",[]))!=365):
        raise ValueError("2026-27 baseline or complete team registry missing")
    if (movement.get("roster_teams")!=365 or
        movement.get("players_audited")!=5537 or
        len(movement.get("teams",[]))!=365 or
        crosswalk.get("roster_players")!=5537 or
        crosswalk.get("linked_count")!=3523 or
        crosswalk.get("strong_count")!=3517 or
        crosswalk.get("unlinked_count")!=2014):
        raise ValueError("Identity evidence or roster coverage differs from release audit")
    if (crosswalk.get("source_blob_sha")!="a3ef41958b35d2880643f9d24756d6edc20aead3" or
        crosswalk.get("season")!="2026-27"):
        raise ValueError("Pinned NCAA/ESPN identity crosswalk changed")
    if (validation.get("approved_for_shadow_experiment") is not True or
        validation.get("untouched_holdout_season")!=2026 or
        validation.get("test_candidate",{}).get("log_loss",99)>=validation.get("test_baseline",{}).get("log_loss",0) or
        validation.get("test_candidate",{}).get("brier",99)>=validation.get("test_baseline",{}).get("brier",0)):
        raise ValueError("Historical validation of preregistered coefficients did not pass")
    beta_ret=validation["training"]["retention_beta"]
    beta_transfer=validation["training"]["transfer_beta"]
    if (beta_ret,beta_transfer)!=(120,160):
        raise ValueError("Unreviewed coefficient change")
    by_id={x["team_id"]:x for x in baseline["rankings"]}
    teams={x["id"]:x for x in registry["teams"]}
    if len(by_id)!=365 or len(teams)!=365 or set(by_id)!=set(teams):
        raise ValueError("Baseline does not match complete 365-team membership")
    denominators={x["team_id"]:float(x["prior_minutes"]) for x in minutes_report["teams"]}
    if len(denominators)!=365 or set(denominators)!=set(teams):
        raise ValueError("Prior-season NCAA total minutes missing from 365-team audit")
    by_roster={x["team_id"]:x for x in movement["teams"]}
    if len(by_roster)!=365 or set(by_roster)!=set(teams):
        raise ValueError("Current rosters do not match 365-team registry")
    athletes={}
    for tid,school in by_roster.items():
        for person in school["players"]:
            eid=str(person["current_id"])
            if eid in athletes:
                raise ValueError("Current athlete counted twice: "+eid)
            athletes[eid]=(tid,person)
    if len(athletes)!=movement["players_audited"]:
        raise ValueError("Roster participant count is incorrect")
    used=set()
    running={tid:{"returning":0.0,"incoming":0.0,"verified_box_players":0} for tid in teams}
    unmeasured=0
    label_conflicts=0
    fuzzy_excluded=0
    measured=0
    for link in crosswalk["links"]:
        eid=str(link["id"])
        if eid in used or eid not in athletes:
            raise ValueError("Unrecognized or repeated direct player-ID link: "+eid)
        used.add(eid)
        if link.get("method")=="jaro_winkler":
            fuzzy_excluded+=1
            continue
        if link.get("method") not in ("name_jersey","name","last_jersey"):
            raise ValueError("Unapproved NCAA-ESPN crosswalk join method")
        tid,raw=athletes[eid]
        previous=link.get("prior")
        if previous not in teams or not str(link.get("pid","")).isdigit():
            raise ValueError("Unknown prior-school ID or invalid NCAA player ID")
        prior_minutes=raw.get("prior_minutes")
        if (not isinstance(prior_minutes,(int,float)) or
            not math.isfinite(prior_minutes) or prior_minutes<=0 or
            raw.get("prior_school_id")!=previous):
            unmeasured+=1
            if raw.get("prior_school_id") and raw["prior_school_id"]!=previous:
                label_conflicts+=1
            continue
        segment="returning" if previous==tid else "incoming"
        running[tid][segment]+=float(prior_minutes)
        running[tid]["verified_box_players"]+=1
        measured+=1
    if len(used)!=3523:
        raise ValueError("Identity crosswalk record count mismatch")
    feat={}
    for tid,school in by_roster.items():
        denominator=denominators[tid]
        if denominator<1000 or school["roster_players"]<8:
            continue
        data=running[tid]
        feat[tid]={
            "returning_minutes_share":min(1.0,data["returning"]/denominator),
            "incoming_transfer_minutes_share":min(1.5,data["incoming"]/denominator),
            "returning_minutes":round(data["returning"],2),
            "incoming_minutes":round(data["incoming"],2),
            "prior_minutes_denominator":round(denominator,2),
            "players_with_verified_historical_minutes":data["verified_box_players"]}
    if len(feat)!=364 or not all(f["players_with_verified_historical_minutes"]>0 for f in feat.values()):
        raise ValueError("Unexpected program-level verified minutes coverage")
    median_r=median_high([f["returning_minutes_share"] for f in feat.values()])
    median_t=median_high([f["incoming_transfer_minutes_share"] for f in feat.values()])
    result=[]
    for tid,t in teams.items():
        base=float(by_id[tid]["elo"])
        f=feat.get(tid)
        adjustment=round(beta_ret*(f["returning_minutes_share"]-median_r)+
                         beta_transfer*(f["incoming_transfer_minutes_share"]-median_t),4) if f else 0.0
        result.append({
            "team_id":tid,"team":t["name"],"conference":t.get("conference"),
            "base_elo":round(base,4),"offseason_adjustment":adjustment,
            "elo":round(base+adjustment,4),
            "roster_coverage":"source-confirmed-prior-minutes" if f else "baseline-fallback",
            "returning_minutes_share":round(f["returning_minutes_share"],6) if f else None,
            "incoming_transfer_prior_minutes_share":round(f["incoming_transfer_minutes_share"],6) if f else None,
            "season_games":0,
            "evidence_player_count":f["players_with_verified_historical_minutes"] if f else 0
        })
    result.sort(key=lambda x:(-x["elo"],x["team_id"]))
    for idx,t in enumerate(result,1):
        t["rank"]=idx
    if (len(result)!=365 or
        any(not math.isfinite(x["elo"]) for x in result) or
        any(abs(x["elo"]-x["base_elo"]-x["offseason_adjustment"])>0.00021 for x in result)):
        raise ValueError("Rating integrity mismatch")
    return {
        "model":"slat-ncaam-2026-27-identity-linked-elo-v2",
        "season":"2026-27","status":"provisional-roster-identity-linked",
        "team_count":365,"games_played":0,
        "publication_tier":"roster-informed preseason edition; not fully certified",
        "production_elo_approved":False,
        "preseason_roster_informed":True,
        "preseason_baseline":"data/ncaam-2026-27-preseason-provisional.json",
        "calibration":"data/ncaam-offseason-transfer-backtest.json",
        "parameters":{"retention_beta":beta_ret,"incoming_minutes_beta":beta_transfer,
                      "median_retention":round(median_r,8),"median_incoming_minutes":round(median_t,8)},
        "evidence":{"roster_programs":len(feat),"uncovered_programs":365-len(feat),
                    "current_roster_players":len(athletes),
                    "source_linked_player_ids":crosswalk["linked_count"],
                    "strong_crosswalk_player_ids":crosswalk["strong_count"],
                    "players_with_verified_historical_minutes":measured,
                    "strong_id_players_missing_verified_minutes":unmeasured,
                    "historical_name_match_school_conflicts_excluded":label_conflicts,
                    "fuzzy_id_matches_excluded":fuzzy_excluded,
                    "unlinked_current_players":crosswalk["unlinked_count"],
                    "identity_source_blob":crosswalk["source_blob_sha"],
                    "source_note":"NCAA 2025-26 box minutes; 2026-27 ESPN player roster audit; pinned NCAA/ESPN crosswalk",
                    "limitations":["Historical model was calibrated with earlier exact-name features, not this independently linked-current-roster rule",
                                   "Historical roster snapshot timing remains unverified",
                                   "Unmatched and fuzzy-match players carry no invented production",
                                   "Missing-team historical data retains independent baseline",
                                   "Venue calibration is separate from the provisional preseason Elo"]},
        "rankings":result}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,default=Path("data"))
    parser.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-preseason-roster-informed.json"))
    args=parser.parse_args()
    paths=["ncaam-2026-27-preseason-provisional.json",
           "ncaam-2026-27-team-registry.json",
           "ncaam-2026-27-player-movement-audit.json",
           "ncaam-2026-27-minutes-retention-audit.json",
           "ncaam-2026-27-direct-player-crosswalk.json",
           "ncaam-offseason-transfer-backtest.json"]
    result=build(*(json.loads((args.root/name).read_text(encoding="utf-8")) for name in paths))
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({"teams":result["team_count"],"tier":result["publication_tier"],
          "evidence":result["evidence"],"top_10":[{"team":x["team"],"elo":x["elo"]}
          for x in result["rankings"][:10]]},indent=2))

if __name__=="__main__":main()

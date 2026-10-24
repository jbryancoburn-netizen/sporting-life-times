#!/usr/bin/env python3
"""Verify the NCAA 2026-27 usable preseason release, independently from the
uncertified player-quality challenger. This is NOT certification of prospective
predictive accuracy or as-of historical player rosters.
"""
import json
import math
from pathlib import Path

DATA=Path("data")

def load(name,root=DATA):
    return json.loads((root/name).read_text(encoding="utf-8"))

def verify(root=DATA):
    current=load("ncaam-2026-27-preseason-roster-informed.json",root)
    prior=load("ncaam-2026-27-preseason-provisional.json",root)
    decision=load("ncaam-exact-scoring-promotion-decision.json",root)
    audit=load("ncaam-2026-27-scoring-parity-reproducible.json",root)
    report=load("ncaam-exact-scoring-formula-retrospective-backtest.json",root)
    failures=[]
    teams=current.get("rankings",[])
    base=prior.get("rankings",[])
    n=current.get("team_count")
    if n!=365 or len(teams)!=365 or len(base)!=365:failures.append("TEAM_COUNT_NOT_365")
    if current.get("season")!="2026-27" or current.get("games_played")!=0:
        failures.append("WRONG_SEASON_OR_PRESEASON_STATE")
    base_ids={x.get("team_id") for x in base}
    ids=[x.get("team_id") for x in teams]
    if len(set(ids))!=len(teams) or set(ids)!=base_ids:
        failures.append("TEAM_IDS_DUPLICATE_OR_NOT_IN_INDEPENDENT_BASELINE")
    baseline={x["team_id"]:x for x in base}
    fallback=[]
    for i,t in enumerate(teams):
        if t.get("rank")!=i+1:failures.append("INVALID_RANK_ORDER")
        if i and teams[i-1]["elo"]+0.000001<t["elo"]:failures.append("NOT_SORTED_BY_ELO")
        if any(not isinstance(t.get(k),(int,float)) or not math.isfinite(t[k])
               for k in ("elo","base_elo","offseason_adjustment")):
            failures.append("NONFINITE_RATING");continue
        if abs(t["base_elo"]+t["offseason_adjustment"]-t["elo"])>0.00011:
            failures.append("ELO_COMPONENT_SUM_MISMATCH")
        prev=baseline.get(t["team_id"])
        if prev and abs(prev["elo"]-t["base_elo"])>0.00011:
            failures.append("PRIOR_BASELINE_ID_MISMATCH")
        if t.get("roster_coverage")=="baseline-fallback":
            fallback.append(t["team"])
            if abs(t["offseason_adjustment"])>0.000001:
                failures.append("FALLBACK_TEAM_NOT_NEUTRAL")
    if len(fallback)!=1:failures.append("EXPECTED_ONE_UNCOVERED_PROGRAM")
    if decision.get("promotion_approved") is not False or audit.get("production_approval") is not False:
        failures.append("UNCERTIFIED_QUALITY_COEFFICIENT_PROMOTED")
    if audit.get("same_source_identity_rule") is not False or audit.get("same_scoring_reference") is not False:
        failures.append("SCORING_FORMULA_PARITY_CHANGED_REASSESS")
    if report.get("production_approval") is not False:
        failures.append("RETROSPECTIVE_REPORT_MISLABELED_PRODUCTION")
    if current.get("production_elo_approved") is not False:
        failures.append("UNSUPPORTED_FULL_PRESEASON_CERTIFICATION")
    if not (report["holdout_minutes_plus_quality"]["log_loss"]<report["holdout_minutes_only"]["log_loss"]
            and report["holdout_minutes_plus_quality"]["brier"]<report["holdout_minutes_only"]["brier"]):
        failures.append("REPORTED_RETROSPECTIVE_ACCURACY_GAIN_NOT_REPRODUCED")
    failures=sorted(set(failures))
    return {
        "season":"2026-27",
        "checks_passed":not failures,
        "failures":failures,
        "release_decision":"PUBLISH_EXISTING_ROSTER_INFORMED_PRESEASON_WITH_EXPLICIT_PROVISIONAL_LABEL" if not failures else "BLOCK_PRESEASON_RELEASE",
        "scoring_quality_promotion":"REJECT_UNTIL_ASOF_PRESEASON_AND_FEATURE_PARITY_VALIDATED",
        "rating_source":"data/ncaam-2026-27-preseason-roster-informed.json",
        "team_count":len(teams),
        "distinct_ids":len(set(ids)),
        "baseline_fallback_teams":fallback,
        "inseason_transition":"NOT_VERIFIED_BY_THIS_GATE",
        "predictive_accuracy_certification":"NOT_CLAIMED",
        "retrospective_2026_games":report["holdout_minutes_only"]["games"],
        "retrospective_log_loss_baseline":report["holdout_minutes_only"]["log_loss"],
        "retrospective_log_loss_quality":report["holdout_minutes_plus_quality"]["log_loss"],
        "data_limitations":[
            "Historical roster archive has no demonstrated as-of-before-season snapshots",
            "Historical scorer matched unique exact names; current rosters used corroborated crosswalk IDs",
            "Historical and current player scoring reference rates differ",
            "No claim that provisional 2026-27 Elo has been prospective-calibrated"
        ]
    }

def main():
    result=verify()
    output=DATA/"ncaam-2026-27-release-decision.json"
    output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2))
    if not result["checks_passed"]:raise SystemExit(1)

if __name__=="__main__":main()

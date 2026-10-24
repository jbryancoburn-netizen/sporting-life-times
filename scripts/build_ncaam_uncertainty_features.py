#!/usr/bin/env python3
"""Observed preseason roster uncertainty features, NOT guessed Elo volatility.

All 365 schools retain independently published ratings. This is a feature
dataset to train future game-update uncertainty, not a numerical uncertainty
probability or an approved player-value estimate.
"""
import json
from pathlib import Path

def build(roster,source):
    teams=roster["rankings"]
    prior={x["team_id"]:x for x in source["teams"]}
    assert len(teams)==len(prior)==365
    assert {x["team_id"] for x in teams}==set(prior)
    out=[]
    for r in teams:
        tid=r["team_id"];s=prior[tid]
        retention=r["returning_minutes_share"]
        incoming=r["incoming_transfer_prior_minutes_share"]
        if retention is not None: assert 0<=retention<=1
        if incoming is not None: assert 0<=incoming<=1
        linked=int(s["linked_transfers_with_source_elo"])
        missing=int(s["linked_transfers_without_source_elo"])
        uncovered=r["roster_coverage"]=="baseline-fallback"
        out.append({
          "team_id":tid,"team":r["team"],"conference":r["conference"],
          "preseason_elo":r["elo"],
          "returning_minutes_share":retention,
          "incoming_verified_transfer_minutes_share":incoming,
          "verified_prior_player_count":r["evidence_player_count"],
          "verified_returner_count":s["verified_returners"],
          "linked_transfers_with_source_elo":linked,
          "linked_transfers_without_source_elo":missing,
          "transfer_source_weighted_elo":s["transfer_source_weighted_2025_26_elo"],
          "transfer_source_program_count":s["source_programs"],
          "missing_program_history":uncovered,
          "observed_roster_churn_share":round(1-retention,6) if retention is not None and not uncovered else None,
          "uncertainty_coefficient":None,
          "elo_update_speed_multiplier":None,
          "feature_status":"OBSERVED_RESEARCH_NO_CALIBRATED_PROBABILITY"})
    return {"model":"slat-ncaam-preseason-uncertainty-features-v1",
        "status":"FEATURES_ONLY_NOT_CALIBRATED_DO_NOT_PROMOTE",
        "season":"2026-27","team_count":len(out),
        "linked_transfer_source_teams":sum(x["transfer_source_weighted_elo"] is not None for x in out),
        "roster_churn_observed_teams":sum(x["observed_roster_churn_share"] is not None for x in out),
        "uncertainty_coefficient_fitted":False,"production_elo_changed":False,
        "limitations":["Observed roster churn is not equivalent to forecast variance",
          "Unlinked recruits and incoming freshmen lack prior verified D-I value",
          "Historical opening-day roster snapshots remain unverified",
          "No learned mapping to individual-team K factor or win probability"],
        "teams":out}
if __name__=="__main__":
    d=Path("data")
    r=build(json.loads((d/"ncaam-2026-27-preseason-roster-informed.json").read_text()),
            json.loads((d/"ncaam-2026-27-transfer-source-strength-audit.json").read_text()))
    (d/"ncaam-2026-27-preseason-uncertainty-features.json").write_text(json.dumps(r,indent=2)+"\n")
    print("Uncertainty features:",r["team_count"],"teams;",r["linked_transfer_source_teams"],"with source Elo; no production change")

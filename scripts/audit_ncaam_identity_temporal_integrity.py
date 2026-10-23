#!/usr/bin/env python3
"""Fail-closed provenance gate for offseason player identity and preseason timing.

Do not confuse a historical season=2026 query with a timestamped snapshot
available before the 2025-26 opening tip. A later API response is retrospective.
"""
import argparse,json
from pathlib import Path

def audit(identity,production,exposure):
    if identity.get("teams_current")!=365:raise ValueError("Current roster incomplete")
    if production.get("teams_audited")!=365 or exposure.get("teams_audited")!=365:
        raise ValueError("Production or opponent exposure missing schools")
    c=identity["counts"]
    total=c.get("verified_espn_returner",0)+c.get("verified_espn_d1_transfer",0)
    if c.get("verified_espn_continuity",total)!=total:raise ValueError("Identity continuity total mismatch")
    if total!=production["counts"].get("verified_espn_returners",0)+production["counts"].get("verified_espn_transfers",0):
        raise ValueError("Identity and production movement totals disagree")
    if total!=exposure["counts"].get("verified_espn_returners",0)+exposure["counts"].get("verified_espn_transfers",0):
        raise ValueError("Identity and exposure movement totals disagree")
    pcounts=production["counts"]
    ecounts=exposure["counts"]
    if pcounts.get("unique_ncaa_box_candidates",0)+pcounts.get("unresolved_box_candidates",0)!=total:
        raise ValueError("Every ESPN movement must resolve to exactly one box candidate or unresolved state")
    if ecounts.get("candidate_exposure_players",0)+ecounts.get("unresolved_exposure",0)!=total:
        raise ValueError("Every ESPN movement must resolve to exactly one opponent exposure or unresolved state")
    if production["counts"].get("unique_ncaa_box_candidates",0)>total:
        raise ValueError("More NCAA candidates than verified ESPN movements")
    if exposure["counts"].get("candidate_exposure_players",0)>production["counts"].get("unique_ncaa_box_candidates",0):
        raise ValueError("Opponent exposure exceeds NCAA production candidates")
    blockers={
        "historical_roster_asof_not_proven":identity.get("historical_roster_asof_verified") is not True,
        "ncaa_box_identity_not_source_verified":production.get("cross_provider_identity_verified") is not True,
        "opponent_calibration_not_approved":exposure.get("opponent_adjustment_calibrated_for_verified_identities") is not True,
        "historical_espn_coverage_incomplete":identity.get("teams_prior")!=365,
        "duplicate_current_athlete_ids":bool(identity.get("duplicate_current_athlete_ids")),
        "historical_roster_partial":bool(identity.get("historical_partial_roster_teams")),
        "historical_season_payload_not_source_verified":identity.get("historical_season_payload_verified") is not True,
    }
    return {"season":"2026-27","teams_audited":365,"espn_identity_verified_players":total,
        "candidate_box_players":production["counts"].get("unique_ncaa_box_candidates",0),
        "candidate_opponent_exposure_players":exposure["counts"].get("candidate_exposure_players",0),
        "release_blockers":blockers,
        "release_blocker_count":sum(bool(v) for v in blockers.values()),
        "release_blocker_names":[k for k,v in blockers.items() if v],
        "release_approved":not any(blockers.values()),
        "decision":"HOLD: no unapproved offseason player adjustments may seed published NCAA Elo" if any(blockers.values()) else "All automated provenance gates passed; requires separate model approval"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--identity",default="data/ncaam-2026-27-espn-identity-continuity.json")
    p.add_argument("--production",default="data/ncaam-2026-27-verified-production-coverage.json")
    p.add_argument("--exposure",default="data/ncaam-2026-27-verified-movement-opponent-exposure.json")
    p.add_argument("--out",default="data/ncaam-2026-27-identity-temporal-gate.json")
    a=p.parse_args()
    result=audit(*[json.loads(Path(path).read_text()) for path in (a.identity,a.production,a.exposure)])
    Path(a.out).write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
if __name__=="__main__":main()

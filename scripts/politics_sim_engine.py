#!/usr/bin/env python3
"""Unbiased Monte Carlo mechanics for research; no uncertified live election odds.

The engine takes ORIGINAL estimated vote margins and empirically CALIBRATED
shared-national, shared-state and local error standard deviations (pp).
It never reads forecasts from politics-data.json or external prediction desks.

Main CLI is a fail-closed input readiness monitor. It DOES NOT simulate 2026
races until each source and holdout validation gate is independently certified.
"""
from __future__ import annotations
from collections import Counter
import datetime as dt
import json
import math
import pathlib
import random

ROOT=pathlib.Path(__file__).resolve().parents[1]
VALID_STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())

class UncertifiedForecast(ValueError):
    pass

REQUIRED_SOURCE_GATES=(
  "official_2026_ballot_candidates_verified",
  "2024_presidential_vote_retabulated_on_2026_districts",
  "2026_district_boundaries_verified",
  "individual_race_polls_quality_audited",
  "historical_out_of_sample_calibration_passed",
  "national_state_local_residual_scales_empirically_calibrated",
  "all_435_house_races_covered",
)

def release_gate(source_manifest,readiness):
    if not isinstance(source_manifest,dict) or not isinstance(readiness,dict):
        return False,["model input manifest is absent"]
    problems=[name for name in REQUIRED_SOURCE_GATES if source_manifest.get(name) is not True]
    if readiness.get("house_forecast_ready") is not True:
        problems.append("independent source-readiness audit has not certified House predictions")
    return not problems,problems

def validate_races(races):
    if not isinstance(races,list) or not races:
        raise ValueError("Must supply one or more race models with original point estimates")
    ids=set()
    for race in races:
        if not isinstance(race,dict):raise ValueError("Non-object race")
        identity=race.get("race_id")
        state=race.get("state")
        margin=race.get("dem_margin_estimate_pp")
        if not isinstance(identity,str) or not identity or identity in ids:raise ValueError("Race ID must be nonempty and unique")
        if state not in VALID_STATES:raise ValueError("Only 50 state House districts are supported")
        if not isinstance(margin,(float,int)) or not math.isfinite(margin) or not -100<=margin<=100:
            raise ValueError("Real-valued Democratic victory margin estimate required, in percentage points")
        ids.add(identity)

def validate_sigmas(error):
    if not isinstance(error,dict):raise ValueError("Missing independently calibrated errors")
    names=("national","state","race")
    sigma={}
    for name in names:
        val=error.get(name)
        if not isinstance(val,(int,float)) or not math.isfinite(val) or not 0<=val<=50:
            raise ValueError("Invalid "+name+" standard deviation")
        sigma[name]=float(val)
    if not any(sigma.values()):raise ValueError("Zero variance is not a probabilistic model")
    return sigma

def simulate_core(races,error,draws=2000,seed=2026,control_threshold=None):
    """Mechanics ONLY: caller must certify input data and error calibration.

    Each simulation samples one national shock, one common shock per state,
    and independent race shocks; outcomes are therefore NOT independent.
    Tests use fabricated toy inputs but production must never publish them.
    """
    validate_races(races)
    sig=validate_sigmas(error)
    if not isinstance(draws,int) or not 100<=draws<=100000:raise ValueError("Simulation sample count out of range")
    if not isinstance(seed,int):raise ValueError("Explicit integer seed required")
    if control_threshold is not None and (not isinstance(control_threshold,int) or not 1<=control_threshold<=len(races)):
        raise ValueError("Invalid chamber threshold")
    states=sorted({r["state"] for r in races})
    rng=random.Random(seed)
    wins=Counter()
    totals=[]
    chamber_control=0
    for _ in range(draws):
        national=rng.gauss(0,sig["national"])
        state={st:rng.gauss(0,sig["state"]) for st in states}
        dem_count=0
        for race in races:
            local=rng.gauss(0,sig["race"])
            margin=race["dem_margin_estimate_pp"]+national+state[race["state"]]+local
            if margin>0:
                wins[race["race_id"]]+=1
                dem_count+=1
        totals.append(dem_count)
        if control_threshold is not None and dem_count>=control_threshold:
            chamber_control+=1
    sorted_totals=sorted(totals)
    def percentile(p):
        return sorted_totals[min(draws-1,max(0,round((draws-1)*p)))]
    return {
      "engine_version":"1.0",
      "draws":draws,"seed":seed,
      "race_count":len(races),"national_state_race_correlated":True,
      "mean_dem_wins":round(sum(totals)/draws,3),
      "dem_seat_p05":percentile(.05),
      "dem_seat_p50":percentile(.50),
      "dem_seat_p95":percentile(.95),
      "control_probability":round(chamber_control/draws,5) if control_threshold is not None else None,
      "win_probabilities":{race["race_id"]:round(wins[race["race_id"]]/draws,5) for race in races},
      "simulated_dem_seat_totals":totals
    }

def run_certified_2026_house_model(races,calibrated_errors,manifest,readiness,draws=2000,seed=2026):
    ok,problems=release_gate(manifest,readiness)
    if not ok:raise UncertifiedForecast("House model not certified: "+", ".join(problems))
    if len(races)!=435:raise UncertifiedForecast("House simulation needs all 435 districts")
    # Dataset must include the historic inputs and published provenance; no
    # commercial prediction probabilities can be substituted as inputs.
    for race in races:
        if race.get("source_type")!="original_verified_2026":
            raise UncertifiedForecast("Unverified or projected input in race "+str(race.get("race_id")))
        if not race.get("ballot_verified") or not race.get("2026_geography_verified"):
            raise UncertifiedForecast("2026 race lacks certified candidates or district geography")
    result=simulate_core(races,calibrated_errors,draws,seed,control_threshold=218)
    # Return is for an eventual certified model publisher, not current CLI.
    result.pop("simulated_dem_seat_totals")
    return result

def audit_file(readiness):
    ok,gaps=release_gate({},readiness)
    return {
        "status":"ENGINE_BUILT_INPUTS_NOT_CERTIFIED",
        "checked_at":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "engine_version":"1.0","available_components":[
            "reproducibly seeded Monte Carlo draws",
            "common national voting error",
            "state-correlated voting error",
            "race-specific voting error",
            "two-party margin-to-winner sampling",
            "House majority threshold with 435-source-record requirement",
            "hard input-provenance and out-of-sample calibration gate"],
        "country_scope":"50 U.S. states","office_scope":"U.S. House model mechanics only; Senate and governors require separate control/contest models",
        "national_sigma_pp":None,"state_sigma_pp":None,"race_sigma_pp":None,
        "calibration_status":"NOT YET MEASURED FROM A VALID 2026-BOUNDARY OUT-OF-SAMPLE RESEARCH DESIGN",
        "unmet_source_gates":gaps,
        "forecast_2026_certified":False,
        "certified_2026_probability_count":0,
        "published_real_seat_simulations":0,
        "warning":"The Monte Carlo algorithm is implemented and unit-tested, but its error scales and real 2026 candidate/vote inputs are not calibrated or certified. No demo or synthetic odds are published as predictions."
    }
def main():
    try:
        status=json.loads((ROOT/"politics-sim-readiness.json").read_text(encoding="utf-8"))
    except (ValueError,OSError):status={}
    audit=audit_file(status)
    (ROOT/"politics-engine-status.json").write_text(json.dumps(audit,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Election sim core:",audit["status"],"unmet source gates:",len(audit["unmet_source_gates"]))
if __name__=="__main__":main()

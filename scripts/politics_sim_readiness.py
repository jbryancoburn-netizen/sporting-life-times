#!/usr/bin/env python3
"""Strict independent U.S. election model-input inventory, never forecast odds."""
from __future__ import annotations
import datetime as dt
import json
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name):
    try:return json.loads((ROOT/name).read_text(encoding="utf-8"))
    except (OSError,ValueError):return {}
def stage(name,state,evidence,source,reason,verified_count=None):
    return {"id":name,"state":state,"verified_record_count":verified_count,
        "evidence":evidence,"source":source,"blocker":reason}
def build(data):
    history=data.get("history",{})
    row=data.get("row",{})
    fec=data.get("fec",{})
    census=data.get("census",{})
    polling=data.get("polling",{})
    poll_audit=data.get("poll_audit",{})
    presidential=data.get("presidential",{})
    fec_index=data.get("fec_index",{})
    house=row.get("house",[]) if row.get("status")=="ok" else []
    senate=row.get("senate",[]) if row.get("status")=="ok" else []
    fed=fec.get("candidates",[]) if fec.get("status")=="ok" else []
    census_rows=census.get("districts",[]) if census.get("status")=="ok" else []
    metrics=[
      stage("historical_house_winner_parties","verified" if history.get("winner_party_totals_reconciled") else "missing",
        "2018–2024 officially reconciled House winner-party totals" if history.get("winner_party_totals_reconciled") else "Not certified",
        "U.S. House Historian and MEDSL","Winning party counts alone cannot estimate electoral margins.",1740 if history.get("winner_party_totals_reconciled") else 0),
      stage("historical_house_vote_records","partial" if len(house)>=1700 else "missing",
        f"{len(house)} persistently stored candidate-vote contest summaries from 2018–2024",
        "MIT Election Data and Science Lab (MEDSL)","Missing/uncontested votes, RCV methodology, data lineage, and redistricting compatibility remain incomplete.",len(house)),
      stage("historical_senate_vote_records","partial" if len(senate)>=120 else "missing",
        f"{len(senate)} persistently stored Senate contests, 2018–2024",
        "MIT Election Data and Science Lab (MEDSL)","Needs special-election and governor treatment plus state-level fundamentals and presidential baseline.",len(senate)),
      stage("2026_fec_candidate_registrations","partial" if fed else "missing",
        f"{fec.get('house_count',0)} House and {fec.get('senate_count',0)} Senate FEC registrants" if fed else "No independently ingested FEC 2026 registrations",
        "Federal Election Commission (FEC) candidate master","FEC registrants are not certified nominees or state-verified November ballot candidates.",len(fed)),
      stage("2026_fec_campaign_finance","partial" if fec.get("finance_records_joined",0)>0 else "missing",
        f"{fec.get('finance_records_joined',0)} candidate financial summaries joined to FEC IDs",
        "FEC all-candidate financial reports","Variable reporting end dates, transfers and coverage require harmonization; not a direct vote-share measurement.",fec.get("finance_records_joined",0)),
      stage("2026_fec_district_filing_index","partial" if fec_index.get("status")=="ok" and fec_index.get("house_district_inventory")==435 else "missing",
        f"{fec_index.get('house_districts_with_registrations',0)} of 435 House districts have at least one indexed FEC filing",
        "Official FEC 2026 candidate registration master","A district with a filing is not proof of a general-election ballot candidate; FEC registration status may be stale.",fec_index.get("house_districts_with_registrations",0)),
      stage("2024_presidential_county_vote_returns","partial" if presidential.get("status")=="ok" and presidential.get("state_count")==51 and presidential.get("county_count",0)>=2300 else "missing",
        f"{presidential.get('county_count',0)} counties or equivalents in {presidential.get('state_count',0)} states/DC, from original 2024 returns",
        "MIT Election Data and Science Lab county presidential returns","County returns are not congressional district returns; verification of precinct split and current district boundaries is required.",presidential.get("county_count",0)),
      stage("2024_acs_congressional_district_context","partial" if len(census_rows)==435 else "missing",
        f"{len(census_rows)} Census ACS 119th-Congress district profiles",
        "U.S. Census Bureau ACS 2020–2024","ACS estimates and 2026 district boundaries must be harmonized; demographics do not imply vote choice.",len(census_rows)),
      stage("2026_national_generic_ballot_polls","partial" if polling.get("status")=="ok" else "missing",
        f"{poll_audit.get('eligible_polls',0)} recent eligible polls from {poll_audit.get('unique_pollsters',0)} pollsters",
        "VoteHub polling API CC BY 4.0","Minimum 3 independent pollsters not met, or historical/pollster weights not calibrated.",poll_audit.get("eligible_polls",0)),
      stage("2026_official_general_election_ballot_roster","missing",
        "No authoritative nationwide ballot-by-district roster in the independent data store",
        "Individual state secretary-of-state and county election officials",
        "Verify actual November nominees, withdrawals, write-ins, special elections and no-candidate contests."),
      stage("2026_district_geography_change_table","missing",
        "No verified GIS mapping from 2024 voter districts to 2026 boundaries",
        "U.S. Census Bureau TIGER/Line and state redistricting authorities",
        "Cannot assume 2024 district IDs represent identical voters in 2026."),
      stage("2024_presidential_vote_by_2026_house_district","missing",
        "No 2024 presidential vote totals adjusted to 2026 House boundaries",
        "Official state/county election returns plus checked congressional precinct crosswalks",
        "Required to model durable district partisanship without substituting third-party projections."),
      stage("2026_race_level_polls_and_fundamentals","missing",
        "No de-duplicated, vetted poll-level Senate/House/governor records tied to official nominees",
        "Original pollster releases and election offices",
        "National generic-ballot polls are insufficient for individual race odds."),
      stage("historical_governor_returns","missing",
        "No independently collected per-candidate governor-election vote dataset",
        "State election offices / original historical returns",
        "No independent governor forecast can be trained."),
      stage("holdout_and_correlated_error_calibration","missing",
        "Historical experimental Brier: "+str(history.get("experimental_holdout",{}).get("holdout_brier_score","unavailable")),
        "Our independent experimental House benchmark",
        "Unresolved district-vintage changes, national shared errors and competitive-race calibration; not certified.")
    ]
    forecast_ready=False
    return {
      "status":"NOT_READY_FOR_PUBLIC_PREDICTIONS",
      "evaluated_at":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
      "method":"Primary-source evidence only; external commercial forecasts are never counted as model inputs.",
      "source_keys":{"history":"politics-history.json","historical_contests":"politics-historical-contests.json","fec":"politics-fec-inputs.json","fec_index":"politics-fec-race-index.json","presidential_counties":"politics-2024-county-presidential.json","census":"politics-census-inputs.json","polls":"politics-polls.json"},
      "checks":metrics,"counts":{"verified":sum(x["state"]=="verified" for x in metrics),"partial":sum(x["state"]=="partial" for x in metrics),"missing":sum(x["state"]=="missing" for x in metrics)},
      "house_forecast_ready":forecast_ready,"senate_forecast_ready":forecast_ready,"governor_forecast_ready":forecast_ready,
      "certified_original_probability_count":0,
      "priority":[
        "Complete a precinct-to-2026-district presidential vote crosswalk without assigning whole counties to split districts.",
        "Collect official 2026 state-ballot nominee lists; reconcile to FEC candidate IDs.",
        "Obtain and reconcile 2024 presidential/House district voting baselines and any 2026 boundary changes.",
        "Collect pollster-original 2026 race surveys with dates, sponsors, population and samples; audit duplicates.",
        "Calibrate correlated national/state/district errors on held-out election cycles, and validate competitiveness before publishing probabilities."
      ],
      "warning":"Having 435 historical winner identities is not the same as having 435 complete vote-share observations for model training. FEC registrations are not ballot certification. Missing source data are never imputed with other forecasters' odds."
    }
def main():
    d=build({"history":load("politics-history.json"),"row":load("politics-historical-contests.json"),
             "fec":load("politics-fec-inputs.json"),"fec_index":load("politics-fec-race-index.json"),
             "presidential":load("politics-2024-county-presidential.json"),"census":load("politics-census-inputs.json"),
             "polling":load("politics-polls.json"),"poll_audit":load("politics-poll-health.json")})
    (ROOT/"politics-sim-readiness.json").write_text(json.dumps(d,indent=2,ensure_ascii=False)+"\n")
    print("Readiness:",d["status"],d["counts"],"original forecast probabilities",d["certified_original_probability_count"])
if __name__=="__main__":main()

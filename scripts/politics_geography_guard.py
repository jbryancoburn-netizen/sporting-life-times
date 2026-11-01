#!/usr/bin/env python3
"""Verify Census 120th Congress map vintages before any 2026 district forecast.

This deliberately does NOT compute presidential votes on 2026 districts.
"""
import datetime as dt
import json
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]
STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())
REVISED=set("AL CA FL LA NC OH TN TX UT".split())
CENSUS="https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.120th_Congress.html"

def validate(data):
    if data.get("schema_version")!=1 or data.get("status")!="OFFICIAL_2026_BOUNDARY_VINTAGE_RESEARCH_ONLY":
        raise ValueError("Unrecognized Congress/district version registry")
    if data.get("official_source_url")!=CENSUS or data.get("reference_election")!="2026-11-03":
        raise ValueError("Incorrect 2026 election or federal authority")
    if data.get("election_district_vintage")!="120th_Congress_2026":
        raise ValueError("2026 House requires 120th Congress geographic definitions")
    if data.get("prior_district_vintage")!="119th_Congress_used_in_2024":
        raise ValueError("Incorrect 2024 House election district vintage")
    if set(data.get("official_2026_boundary_change_states",[]))!=REVISED:
        raise ValueError("New 2026 boundary states differ from current Census official finding")
    rows=data.get("states")
    if not isinstance(rows,list) or len(rows)!=50 or {x.get("state") for x in rows}!=STATES:
        raise ValueError("All 50 states must have unique geography rows")
    for state in rows:
        abbr=state["state"]
        expected="changed_for_2026_official_census" if abbr in REVISED else "no_reported_change_from_2024_census"
        if state.get("boundary_status")!=expected or state.get("census_2026_boundary_source")!=CENSUS:
            raise ValueError("Misclassified official 2026 map boundaries: "+abbr)
        for key in ("verified_2024_presidential_vote_retabulated_on_2026_house_districts",
                    "verified_2024_precinct_to_2026_house_district_crosswalk","forecast_geography_eligible"):
            if state.get(key) is not False:raise ValueError("Unverified geographic inputs cannot be certified: "+abbr)
    mo=data.get("missouri_special_case",{})
    if mo.get("state")!="MO" or mo.get("uses_2024_congressional_boundaries_in_2026") is not True or mo.get("census_2026_early_geospatial_files_may_be_stale") is not True:
        raise ValueError("Missouri 2026 judicial/map-vintage exception must remain explicit")
    fl=data.get("geographic_source_registry",{}).get("FL",{})
    if fl.get("plan")!="EOGPCRP2026" or fl.get("enacted")!="2026-05-04":
        raise ValueError("Incorrect official 2026 Florida plan")
    if not fl.get("official_block_equivalency_file","").startswith("https://edr.state.fl.us/Content/redistricting/2026redistricting/"):
        raise ValueError("Florida block equivalency source is not the state legislature")
    if fl.get("file_verified_transformed_to_2024_presidential_precincts") is not False:
        raise ValueError("We have not computed precinct vote alignment from Florida block files")
    if data.get("2024_presidential_counties_are_not_congressional_district_totals") is not True:
        raise ValueError("County returns must not be misused as House district totals")
    for key in ("2026_district_vote_baseline_certified","forecast_eligible"):
        if data.get(key) is not False:raise ValueError("No certified 2026 district-vote aggregation")
    if data.get("certified_2026_probability_count")!=0:
        raise ValueError("No 2026 map-adjusted election odds may be published")
    return {
        "status":"VERIFIED_OFFICIAL_DISTRICT_VINTAGES_NOT_DISTRICT_VOTES",
        "evaluated_at":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "states_checked":50,"boundary_changed_states":sorted(REVISED),
        "boundary_changed_states_count":9,
        "missouri_2026_boundary_remains_2024":True,
        "states_with_complete_precinct_crosswalk":0,
        "states_with_certified_2024_presidential_vote_on_2026_districts":0,
        "original_2026_house_model_geography_eligible":False,
        "certified_2026_probability_count":0,
        "source_url":CENSUS,
        "warning":"Census-vetted maps identify vintage changes only. The 2024 presidential county data are not allocated into 2026 House districts. Nine states have new maps; Missouri remains on the 2024 map. No direct district ID inheritance or whole-county vote assignment is permitted."
    }

def main():
    source=json.loads((ROOT/"politics-2026-district-geography.json").read_text(encoding="utf-8"))
    report=validate(source)
    (ROOT/"politics-geography-audit.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("Certified Census state boundary vintages:",report["states_checked"],"new maps:",report["boundary_changed_states_count"],"certified district vote baselines: 0")
if __name__=="__main__":main()

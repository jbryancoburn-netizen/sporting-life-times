#!/usr/bin/env python3
"""An ORIGINAL 2012–2016 MIT House/Senate result archive, not live forecasts.

Older district elections are intentionally a separate archival file because
identical district numbers across redistricting do not identify identical
populations. Winner counts need official reconciliation before certification.
"""
from __future__ import annotations
import datetime as dt
import json
import pathlib
import sys
try:
    from scripts.politics_history import (
        APPORTIONMENT,collate,load_year,apportionment_audit,SOURCE,CREDIT_HOUSE,CREDIT_SENATE
    )
except ImportError:
    from politics_history import (
        APPORTIONMENT,collate,load_year,apportionment_audit,SOURCE,CREDIT_HOUSE,CREDIT_SENATE
    )

ROOT=pathlib.Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/"politics-historical-archive.json"
STATUS=ROOT/"politics-historical-archive-status.json"
YEARS=(2012,2014,2016)
def build(loader=load_year,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    output={"status":"collecting","updated_at":now.isoformat(timespec="seconds"),
            "years":list(YEARS),"source":SOURCE,"license":"CC0 1.0",
            "provenance":{"house":CREDIT_HOUSE,"senate":CREDIT_SENATE},
            "vintage_policy":"research_archive_not_boundary_verified_model_training",
            "district_geography_certified":False,"reconciled_against_official_chamber_totals":False,
            "2026_forecast_eligible":False,"house":[],"senate":[],"coverage":{},
            "warning":"Raw original-data historical race summaries; no official House-seat reconciliation or vintage-matched 2026 district boundaries are claimed. Do not fold into a current election model without contest-by-contest validation."}
    for chamber in ("house","senate"):
        chamber_count=0
        two_party_count=0
        quality_by_year={}
        for year in YEARS:
            raw=loader(chamber,year)
            contests,quality=collate(raw,chamber,year)
            if chamber=="house":
                allocation=apportionment_audit(raw,year)
                quality["apportionment"]=allocation
                if allocation["expected_voting_house_districts"]!=435 or allocation["missing_districts"]:
                    raise ValueError(f"Missing House district records for {year}: {allocation}")
            minimum=410 if chamber=="house" else 24
            if len(contests)<minimum:
                raise ValueError(f"Insufficient {chamber} results in {year}: {len(contests)}")
            for race in contests:
                output[chamber].append({"year":year,**race,
                    "source_url":f"https://api.electiondata.dev/v1/{chamber}-results/table/{year}.json",
                    "geography_vintage":"2010_apportionment" if chamber=="house" else "statewide"})
            quality_by_year[str(year)]=quality
            chamber_count+=len(contests)
            two_party_count+=sum(c.get("two_party_margin") is not None for c in contests)
        output["coverage"][chamber]={"observed_contests":chamber_count,
            "observed_two_party_margin_records":two_party_count,
            "years":quality_by_year}
    output["status"]="ok"
    return output
def main():
    checked=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    try:
        out=build()
        ARCHIVE.write_text(json.dumps(out,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
        status={"status":"success","checked_at":checked,
                "house_contests":out["coverage"]["house"]["observed_contests"],
                "senate_contests":out["coverage"]["senate"]["observed_contests"],
                "winner_party_totals_reconciled":False,
                "geography_certified_for_2026":False}
    except Exception as e:
        status={"status":"failed","checked_at":checked,"error":str(e)[:200]}
        print("Archive retrieval/validation failed; previous snapshot preserved:",e,file=sys.stderr)
    STATUS.write_text(json.dumps(status,indent=2)+"\n",encoding="utf-8")
    print("Original historical archive:",status)
    return 0 if status["status"]=="success" else 1
if __name__=="__main__":sys.exit(main())

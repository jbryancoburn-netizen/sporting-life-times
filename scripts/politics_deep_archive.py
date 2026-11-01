#!/usr/bin/env python3
"""Archival 2000–2010 actual MEDSL general election results, research only.

This archive is deliberately kept separate from the verified 2012–2024 desk.
Older district identifiers use 1990/2000 apportionment vintages, and source
winner-party totals and numeric votes are not certified against House Clerk.
"""
from __future__ import annotations
import datetime as dt
import json
import pathlib
import sys

try:
    from scripts.politics_history import collate,load_year,SOURCE,CREDIT_HOUSE,CREDIT_SENATE
except ImportError:
    from politics_history import collate,load_year,SOURCE,CREDIT_HOUSE,CREDIT_SENATE

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"politics-deep-history.json"
STATUS=ROOT/"politics-deep-history-status.json"
YEARS=(2000,2002,2004,2006,2008,2010)

def archive_year(chamber,year,raw):
    races,quality=collate(raw,chamber,year)
    if chamber=="house":
        # Read ONLY actual voting district keys: don't assign 2010 apportionment
        # to the 2000 election or invent which districts existed in 2002.
        districts=set()
        for r in raw:
            if str(r.get("stage") or "").strip().upper() not in ("GEN","GENERAL"):continue
            if str(r.get("year") or "").strip() not in (str(year),str(float(year))):continue
            if str(r.get("state_po") or "").strip().upper() not in ALLOWED_STATES:continue
            if r.get("special") in (True,"TRUE","True","1",1):continue
            if r.get("runoff") in (True,"TRUE","True","1",1):continue
            try: district=int(float(str(r["district"])))
            except (KeyError,TypeError,ValueError):continue
            if not 0<=district<=53:continue
            districts.add(f"{r['state_po'].strip().upper()}-{district:02d}")
        if not 425<=len(districts)<=435:raise ValueError(f"{year} House source district coverage: {len(districts)}")
        if len(races)<410:raise ValueError(f"{year} House numeric contest coverage: {len(races)}")
        quality["source_districts"]=len(districts)
        quality["observed_state_distribution"]={state:sum(x.startswith(state+"-") for x in districts) for state in sorted(ALLOWED_STATES)}
        quality["apportionment_certified"]=False
    else:
        if len(races)<24:raise ValueError(f"{year} Senate numeric contests: {len(races)}")
    records=[{"year":year,**r,"source_url":f"https://api.electiondata.dev/v1/{chamber}-results/table/{year}.json",
             "geography_vintage":("1990_census" if year==2000 else "2000_census") if chamber=="house" else "statewide",
             "candidate_vote_reconciliation_certified":False} for r in races]
    return records,quality

ALLOWED_STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split())
def build(loader=load_year,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    result={"status":"pending_checks","updated_at":now.isoformat(timespec="seconds"),
            "source":"MIT Election Data and Science Lab via electiondata.dev","license":"CC0 1.0",
            "citations":{"house":CREDIT_HOUSE,"senate":CREDIT_SENATE},
            "years":list(YEARS),"house":[],"senate":[],"coverage":{},
            "house_winner_party_totals_certified":False,"district_vintage_reconciled_to_2026":False,
            "forecast_2026_eligible":False,
            "warning":"Original 2000–2010 candidate-vote observations have not been checked against official winning-party totals or reconciled to 2026 district boundaries. Older vintages are archived separately and never used automatically as live forecasting inputs."}
    for chamber in ("house","senate"):
        quality={}
        for year in YEARS:
            races,q=archive_year(chamber,year,loader(chamber,year))
            result[chamber].extend(races)
            quality[str(year)]={"contests":len(races),"quality":q}
        result["coverage"][chamber]={"contests":len(result[chamber]),"by_year":quality}
    result["status"]="ok"
    return result

def main():
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    try:
        data=build()
        OUTPUT.write_text(json.dumps(data,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
        status={"status":"success","checked_at":now,
                "house_contests":len(data["house"]),"senate_contests":len(data["senate"]),
                "forecast_certified":False}
    except Exception as exc:
        status={"status":"failed","checked_at":now,"error":str(exc)[:200]}
        print("Historical source failed; previous archive preserved:",exc,file=sys.stderr)
    STATUS.write_text(json.dumps(status,indent=2)+"\n",encoding="utf-8")
    return 0 if status["status"]=="success" else 1
if __name__=="__main__":sys.exit(main())

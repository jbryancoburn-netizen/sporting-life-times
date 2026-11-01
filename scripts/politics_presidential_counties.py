#!/usr/bin/env python3
"""Presidential voting observations by COUNTY from MIT Election Data and Science Lab.

This is historical vote data, not a 2026 House-district partisanship estimate.
No aggregation from counties to congressional districts is attempted here:
split counties would require verified precinct and boundary crosswalks.
"""
from __future__ import annotations
import collections
import datetime as dt
import json
import math
import pathlib
import sys
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"politics-2024-county-presidential.json"
STATUS=ROOT/"politics-presidential-source-status.json"
SOURCE="https://api.electiondata.dev/v1/county-president/table/2024.json"
CREDIT="MIT Election Data and Science Lab, County Presidential Election Returns 2000–2024, Harvard Dataverse, https://doi.org/10.7910/DVN/VOQCHQ; CC0 1.0."
# Include the 50 states and DC. Geography is strictly counties or equivalent.
STATES=set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split())

def numeric(value):
    if value is None or str(value).strip()=="":return None
    try:
        n=float(value)
        if not math.isfinite(n) or n<0 or n!=int(n):return None
        return int(n)
    except (ValueError,TypeError,OverflowError):return None

def party(raw):
    value=str(raw or "").strip().upper().replace("-"," ").replace("_"," ")
    if value in ("DEMOCRAT","DEMOCRATIC","DEMOCRATIC PARTY","DEM"):return "D"
    if value in ("REPUBLICAN","REPUBLICAN PARTY","REP","GOP"):return "R"
    return "O"

def fetch(url=SOURCE):
    req=urllib.request.Request(url,headers={
      "Accept":"application/json","User-Agent":"Political-Life-and-Times/1.0 (noncommercial source-attributed research)"})
    with urllib.request.urlopen(req,timeout=45) as response:
        if response.status!=200:raise ValueError(f"Presidential data HTTP {response.status}")
        raw=response.read(18_000_001)
        if len(raw)>18_000_000:raise ValueError("Unexpectedly large presidential partition")
    obj=json.loads(raw)
    if not isinstance(obj,dict) or not isinstance(obj.get("rows"),list):raise ValueError("Missing electiondata.dev row list")
    return obj

def normalize(obj,now=None,min_counties=2300,min_voters=100_000_000):
    now=now or dt.datetime.now(dt.timezone.utc)
    rows=obj.get("rows",[])
    if not isinstance(rows,list):raise ValueError("Source rows must be list")
    geography={}
    excluded=collections.Counter()
    for row in rows:
        if not isinstance(row,dict):excluded["non_object"]+=1;continue
        if numeric(row.get("year"))!=2024:excluded["wrong_year"]+=1;continue
        state=str(row.get("state_po") or "").strip().upper()
        if state not in STATES:excluded["unexpected_state"]+=1;continue
        # The source unit_id is defined as the stable county/unit key.
        unit_id=str(row.get("unit_id") or "").strip()
        if not unit_id:excluded["missing_unit_id"]+=1;continue
        candidate=str(row.get("candidate") or "").strip()
        votes=numeric(row.get("candidatevotes"))
        if not candidate or votes is None:
            excluded["invalid_candidate_votes"]+=1;continue
        kind=party(row.get("party"))
        key=(state,unit_id)
        if key not in geography:
            geography[key]={"state":state,"unit_id":unit_id,
                "county_name":str(row.get("county_name") or "").strip(),
                "county_fips":str(row.get("county_fips") or "").strip(),
                "D":0,"R":0,"O":0,"candidate_keys":set(),
                "reported_totalvotes":set(),"source_rows":0}
        target=geography[key]
        unique=(candidate.casefold(),str(row.get("party") or "").strip().casefold())
        if unique in target["candidate_keys"]:
            # Duplicate or voting-mode mix cannot be allowed to double-count.
            excluded["duplicate_candidate_party_unit"]+=1
            continue
        target["candidate_keys"].add(unique)
        target[kind]+=votes
        target["source_rows"]+=1
        reported=numeric(row.get("totalvotes"))
        if reported is not None:target["reported_totalvotes"].add(reported)
    units=[]
    states=collections.defaultdict(lambda:collections.Counter())
    for (state,unit_id),v in sorted(geography.items()):
        major=v["D"]+v["R"]
        if major==0:
            excluded["zero_major_party_units"]+=1;continue
        # Totalvotes provided by MEDSL is informational; never substitute it for
        # missing candidate votes or force our candidate totals to match it.
        reported=sorted(v["reported_totalvotes"])
        item={"id":state+"-"+unit_id,"state":state,"unit_id":unit_id,
              "county":v["county_name"],"county_fips":v["county_fips"] or None,
              "dem_votes":v["D"],"rep_votes":v["R"],"other_votes":v["O"],
              "two_party_votes":major,"dem_two_party_share":round(v["D"]/major,6),
              "dem_margin_pp":round(100*(v["D"]-v["R"])/major,3),
              "source_row_count":v["source_rows"],
              "reported_totalvotes":reported[0] if len(reported)==1 else None,
              "reported_totalvotes_conflict":len(reported)>1}
        units.append(item)
        states[state]["dem_votes"]+=v["D"];states[state]["rep_votes"]+=v["R"];states[state]["other_votes"]+=v["O"]
        states[state]["counties_or_equivalents"]+=1
    totals=collections.Counter()
    state_output=[]
    for state,v in sorted(states.items()):
        d,r=v["dem_votes"],v["rep_votes"]
        total=d+r
        if not total:continue
        totals.update({k:v[k] for k in ("dem_votes","rep_votes","other_votes","counties_or_equivalents")})
        state_output.append({"state":state,"dem_votes":d,"rep_votes":r,
                             "other_votes":v["other_votes"],
                             "counties_or_equivalents":v["counties_or_equivalents"],
                             "dem_two_party_share":round(d/total,6),
                             "dem_margin_pp":round(100*(d-r)/total,3)})
    if len(units)<min_counties or totals["dem_votes"]+totals["rep_votes"]<min_voters or len(state_output)!=51:
        raise ValueError(f"Insufficient 2024 presidential county coverage: units={len(units)} states={len(state_output)} two_party={totals['dem_votes']+totals['rep_votes']}")
    if any(not(0<=x["dem_two_party_share"]<=1) for x in units):raise ValueError("Vote-share bound failure")
    return {"status":"ok","created_at":now.isoformat(timespec="seconds"),
      "election_year":2024,"geography":"county_or_equivalent_not_congressional_district",
      "source":SOURCE,"attribution":CREDIT,"license":"CC0 1.0",
      "source_version":obj.get("meta",{}).get("source") if isinstance(obj.get("meta"),dict) else None,
      "row_count":len(rows),"county_count":len(units),"state_count":len(state_output),
      "two_party_votes":totals["dem_votes"]+totals["rep_votes"],
      "excluded_rows":dict(excluded),"states":state_output,"counties":units,
      "warning":"Original 2024 presidential county returns, not 2026 district-level results. County vote shares cannot be assigned wholesale to House districts spanning partial counties. Must obtain county-to-district precinct crosswalks and verified 2026 boundaries before use in congressional model.",
      "certified_for_2026_house_forecast":False}
def main():
    now=dt.datetime.now(dt.timezone.utc)
    try:
        dataset=normalize(fetch(),now=now)
        OUT.write_text(json.dumps(dataset,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
        status={"checked_at":now.isoformat(timespec="seconds"),"status":"success",
                "counties":dataset["county_count"],"states":dataset["state_count"],
                "two_party_votes":dataset["two_party_votes"]}
        print("Published original 2024 presidential county observations:",status)
    except Exception as e:
        status={"checked_at":now.isoformat(timespec="seconds"),"status":"failed",
                "error":str(e)[:200]}
        print("Presidential source failed, preserving previous valid data:",e,file=sys.stderr)
    STATUS.write_text(json.dumps(status,indent=2)+"\n",encoding="utf-8")
    return 0 if status["status"]=="success" else 1
if __name__=="__main__":sys.exit(main())

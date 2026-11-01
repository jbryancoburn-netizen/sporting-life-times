#!/usr/bin/env python3
"""Group original FEC 2026 filings by House district and state Senate filing.

This is a scouting inventory of registrations, NEVER a certified ballot list.
"""
from __future__ import annotations
import collections
import datetime as dt
import json
import pathlib
from scripts.politics_history import APPORTIONMENT

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE="https://www.fec.gov/campaign-finance-data/candidate-master-file-description/"

def build(fec):
    if fec.get("status")!="ok" or fec.get("cycle")!=2026:
        raise ValueError("No validated current FEC source snapshot")
    rows=fec.get("candidates")
    if not isinstance(rows,list) or len(rows)<300:raise ValueError("FEC candidate records missing")
    allocations=APPORTIONMENT[2020]
    idx={}
    for st,n in sorted(allocations.items()):
        for district in ([0] if n==1 else range(1,n+1)):
            key=f"{st}-{district:02d}"
            idx[key]={"id":key,"state":st,"district":f"{district:02d}",
                    "registered_filings":0,"parties":{},"candidate_ids":[],"finance_records":0,
                    "incumbent_filing_ids":[],"final_ballot_certified":False}
    senate={st:{"state":st,"registered_filings":0,"candidate_ids":[],
                "parties":{},"final_ballot_certified":False,
                "note":"A federal Senate registration does not establish that this state votes for Senate in 2026."}
                for st in sorted(allocations)}
    skipped=collections.Counter()
    seen=set()
    for c in rows:
        identity=c.get("id")
        if not isinstance(identity,str) or not identity or identity in seen:
            skipped["invalid_or_repeated_id"]+=1;continue
        seen.add(identity)
        st=c.get("state")
        if st not in allocations:
            skipped["outside_50_states"]+=1;continue
        if c.get("office")=="H":
            key=f"{st}-{c.get('district')}"
            bucket=idx.get(key)
            if bucket is None:
                skipped["invalid_house_district_for_2020_apportionment"]+=1;continue
        elif c.get("office")=="S":
            bucket=senate[st]
        else:
            skipped["unsupported_office"]+=1;continue
        party=str(c.get("party") or "UNKNOWN").upper()
        bucket["candidate_ids"].append(identity)
        bucket["registered_filings"]+=1
        bucket["parties"][party]=bucket["parties"].get(party,0)+1
        if c.get("finance") is not None:
            bucket["finance_records"]=bucket.get("finance_records",0)+1
        if c.get("office")=="H" and c.get("incumbency_fec")=="I":
            bucket["incumbent_filing_ids"].append(identity)
    for bucket in list(idx.values())+list(senate.values()):
        bucket["candidate_ids"].sort()
        bucket["parties"]=dict(sorted(bucket["parties"].items()))
    if len(idx)!=435 or len(senate)!=50:
        raise ValueError("Expected 435 House districts and 50 Senate states")
    included_house=sum(v["registered_filings"] for v in idx.values())
    included_senate=sum(v["registered_filings"] for v in senate.values())
    return {
        "status":"ok",
        "updated_at":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "cycle":2026,"source":"FEC 2026 candidate master; NOT state-certified ballot roster",
        "source_url":SOURCE,
        "house_district_inventory":435,
        "house_districts_with_registrations":sum(v["registered_filings"]>0 for v in idx.values()),
        "senate_state_inventory":50,
        "senate_states_with_registrations":sum(v["registered_filings"]>0 for v in senate.values()),
        "house_registrations_in_valid_districts":included_house,
        "senate_registrations":included_senate,
        "filing_exclusions":dict(skipped),
        "house":list(idx.values()),"senate":list(senate.values()),
        "forecast_eligible":False,
        "ballot_verified_districts":0,
        "warning":"Each filing is a federal registration, not a certified November 3 ballot entry. Filing ID and party may be stale or withdrawn. FEC incumbent flag is self-reported and does not prove election eligibility. Senate filing counts span all 50 states regardless of whether a Senate race is on the 2026 ballot."
    }
def main():
    path=ROOT/"politics-fec-inputs.json"
    data=json.loads(path.read_text(encoding="utf-8"))
    out=build(data)
    (ROOT/"politics-fec-race-index.json").write_text(json.dumps(out,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("FEC registration scouting ledger:",out["house_districts_with_registrations"],"/435 House districts;",out["senate_states_with_registrations"],"states with Senate filers.",out["filing_exclusions"])
if __name__=="__main__":main()

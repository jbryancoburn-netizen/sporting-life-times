#!/usr/bin/env python3
"""Safely link government-verified 2026 candidate names to their own FEC filings.

No fuzzy names, no guessing missing IDs, no using FEC as ballot authority,
and no election probabilities or voting proxies.
"""
import datetime as dt
import json
import pathlib
import re
import unicodedata
from scripts.politics_ballot_audit import validate

ROOT=pathlib.Path(__file__).resolve().parents[1]
PARTY_MAP={"DEM":"DEM","REP":"REP","LIB":"LIB","GRE":"GRE","IND":"IND"}
MONEY_KEYS=("receipts","disbursements","cash_on_hand","report_end",
            "receipts_excluding_internal_transfers","disbursements_excluding_internal_transfers")

def keyname(name, fec=False):
    if not isinstance(name,str): return ""
    name=unicodedata.normalize("NFKD",name)
    name="".join(c for c in name if not unicodedata.combining(c))
    if fec and "," in name:
        a,b=name.split(",",1)
        name=b+" "+a
    return " ".join(re.sub(r"[^a-z0-9]+"," ",name.casefold()).split())

def district(entry,office):
    if office=="S": return ""
    value=str(entry.get("district") or "").strip()
    return value.zfill(2) if re.fullmatch(r"\d{1,2}",value) else None

def build(ballots,fec,now=None):
    audit=validate(ballots)
    if fec.get("status")!="ok" or fec.get("cycle")!=2026 or not isinstance(fec.get("candidates"),list):
        raise ValueError("Original FEC 2026 candidate file is missing or invalid")
    index={}
    for x in fec["candidates"]:
        if x.get("fec_registration_only") is not True:
            raise ValueError("FEC registrations must not be treated as ballot certification")
        office=x.get("office")
        if office not in ("H","S"):continue
        ident=x.get("id","")
        if not isinstance(ident,str) or not re.fullmatch(r"[HS][A-Z0-9]{8}",ident):continue
        dist=district(x,office)
        if dist is None:continue
        name=keyname(x.get("name"),True)
        if not name:continue
        k=(x.get("state"),office,dist,x.get("party"),name)
        index.setdefault(k,{})[ident]=x
    out=[]; stats={"unique_exact":0,"no_exact_identity":0,"ambiguous":0,"party_not_mapped":0,"matched_finance":0}
    for race in ballots["races"]:
        for p in race["candidates"]:
            row={"race_id":race["id"],"candidate":p["name"],"party":p["party"],
                 "official_source_id":race["source_id"],"official_contest_status":race.get("contest_status","general_ballot_listed"),
                 "status":None,"fec_id":None,"finance":None}
            if p["party"] not in PARTY_MAP:
                row["status"]="party_not_mapped"
            else:
                ids=index.get((race["state"],race["office"],district(race,race["office"]),
                               PARTY_MAP[p["party"]],keyname(p["name"])),{})
                if len(ids)==1:
                    f=next(iter(ids.values()))
                    row["status"]="unique_exact"
                    row["fec_id"]=f["id"]
                    money=f.get("finance")
                    if isinstance(money,dict):
                        row["finance"]={k:money.get(k) for k in MONEY_KEYS}
                        row["finance"]["report_periods_not_harmonized"]=True
                        stats["matched_finance"]+=1
                elif len(ids)>1:row["status"]="ambiguous"
                else:row["status"]="no_exact_identity"
            stats[row["status"]]+=1
            out.append(row)
    if len(out)!=audit["candidate_ballot_entries"] or sum(stats[k] for k in ("unique_exact","no_exact_identity","ambiguous","party_not_mapped"))!=len(out):
        raise ValueError("FEC joins did not conserve all source candidate records")
    return {
        "status":"EXACT_JOIN_DIAGNOSTIC_ONLY",
        "evaluated_at":(now or dt.datetime.now(dt.timezone.utc)).isoformat(timespec="seconds"),
        "source_cycle":2026,"fec_collected_at":fec.get("collected_at"),"official_ballot_reviewed_at":ballots.get("reviewed_at"),
        "candidate_records":len(out),"house_offices":audit["house_contests_transcribed"],
        "senate_offices":audit["senate_contests_transcribed"],"counts":stats,"entries":out,
        "match_rule":"same chamber, state, House district, exact same-party code and exact canonical full name",
        "forecast_eligible":False,"certified_2026_probability_count":0,
        "warning":"A FEC match proves only that an official ballot name appears in the FEC candidate master. FEC registrations are NOT ballots; no fuzzy names, financial period normalization, predictions, or excluded write-in party mappings."
    }

def main():
    ballot=json.loads((ROOT/"politics-official-ballots.json").read_text(encoding="utf-8"))
    fec=json.loads((ROOT/"politics-fec-inputs.json").read_text(encoding="utf-8"))
    d=build(ballot,fec)
    (ROOT/"politics-ballot-fec-crosswalk.json").write_text(json.dumps(d,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("Exact FEC-ID matches:",d["counts"]["unique_exact"],"/",d["candidate_records"],
          "finance records:",d["counts"]["matched_finance"],
          "unresolved:",d["counts"]["no_exact_identity"]+d["counts"]["ambiguous"]+d["counts"]["party_not_mapped"])
if __name__=="__main__":main()

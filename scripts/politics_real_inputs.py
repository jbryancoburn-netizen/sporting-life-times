#!/usr/bin/env python3
"""Official original 2026 candidate filings, FEC finance and Census district context.

FEC filings are NOT certified November ballot slates. Census demographics are
context, not votes. No model or forecast numbers are generated here.
"""
from __future__ import annotations
import csv
import datetime as dt
import io
import json
import math
import os
import urllib.parse
import pathlib
import re
import sys
import urllib.request
import zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
try:
    from scripts.politics_history import APPORTIONMENT
except ImportError:
    from politics_history import APPORTIONMENT
NOW=lambda: dt.datetime.now(dt.timezone.utc)
CYCLE=2026
FEC_URLS={
 "candidates":"https://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
 "financials":"https://www.fec.gov/files/bulk-downloads/2026/weball26.zip",
}
CENSUS_URL="https://api.census.gov/data/2024/acs/acs5?get=NAME,B01003_001E,B19013_001E,B15003_001E,B15003_022E,B15003_023E,B15003_024E,B15003_025E&for=congressional%20district:*&in=state:*"
FIPS={
"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
"12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS",
"21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS",
"29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY",
"37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC",
"46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
"55":"WI","56":"WY"}
def get_bytes(url,limit=25_000_000):
    req=urllib.request.Request(url,headers={
        "User-Agent":"Political-Life-and-Times/1.0 (noncommercial source-linked civic data)",
        "Accept":"application/octet-stream, application/zip, application/json, */*"})
    with urllib.request.urlopen(req,timeout=45) as response:
        if response.status!=200:raise ValueError(f"HTTP {response.status}: {url}")
        blob=response.read(limit+1)
        if len(blob)>limit:raise ValueError(f"Refuse oversized source: {url}")
        return blob

def unzip_tabular(data,min_fields):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        safe=[name for name in z.namelist() if name.lower().endswith((".txt",".csv")) and not name.startswith("__")]
        if len(safe)!=1:raise ValueError("Unexpected FEC ZIP members: "+str(safe)[:200])
        with z.open(safe[0]) as stream:
            # These are pipe-delimited bulk files, sometimes CSV. Permit both.
            text=io.TextIOWrapper(stream,encoding="utf-8-sig",errors="replace",newline="")
            first=text.readline()
            sep="|" if first.count("|")>=first.count(",") else ","
            text.seek(0)
            reader=csv.reader(text,delimiter=sep)
            rows=[]
            for row in reader:
                if not any(str(cell).strip() for cell in row):continue
                if len(row)<min_fields:raise ValueError(f"FEC field width {len(row)} < {min_fields}")
                rows.append(row)
            return rows

def number(val):
    try:
        n=float(str(val).strip().replace(",",""))
        return round(n,2) if math.isfinite(n) else None
    except (ValueError,TypeError):return None

def parse_fec_candidates(rows):
    valid_states=set(FIPS.values())
    result=[]
    seen=set()
    for row in rows:
        # cn.txt order per FEC Candidate Master description (15 columns).
        ident,name,party,year,state,office,district,ici,status,pcc=row[:10]
        if year.strip()!="2026" or office.strip() not in ("H","S"):continue
        state=state.strip().upper()
        if state not in valid_states or not re.fullmatch("[HS][A-Z0-9]{8}",ident.strip()):continue
        if not re.fullmatch(r"\d{1,2}",district.strip()):continue
        key=ident.strip()
        if key in seen:raise ValueError("Duplicate FEC candidate ID: "+key)
        seen.add(key)
        result.append({"id":key,"name":name.strip(),"party":party.strip().upper(),"state":state,
                       "office":office.strip(),"district":district.strip().zfill(2),
                       "incumbency_fec":ici.strip().upper(),"filing_status":status.strip().upper(),
                       "principal_committee":pcc.strip(),"fec_registration_only":True,
                       "district_within_2020_apportionment":office.strip()=="S" or (int(district.strip())<=APPORTIONMENT[2020][state] and (int(district.strip())>=1 if APPORTIONMENT[2020][state]>1 else int(district.strip())==0))})
    result.sort(key=lambda c:(c["office"],c["state"],c["district"],c["id"]))
    if not result:raise ValueError("No valid 2026 FEC House or Senate records")
    return result

def parse_fec_financials(rows,ids):
    result={}
    # weball26: FEC All Candidates file, 30 column schema published by FEC.
    # no name, mailing addresses or donation-level personal information published here.
    for r in rows:
        ident=r[0].strip()
        if ident not in ids:continue
        receipts=number(r[5]);disbursements=number(r[7]);cash=number(r[10])
        if receipts is None or disbursements is None or cash is None:continue
        from_auth=number(r[6]);to_auth=number(r[8])
        # FEC warns that candidate summaries may count transfers among a
        # candidate's own authorized committees twice. Preserve raw numbers,
        # and calculate adjusted totals only when both component fields exist.
        adjusted_receipts=(round(receipts-from_auth,2) if from_auth is not None and 0<=from_auth<=receipts else None)
        adjusted_disbursements=(round(disbursements-to_auth,2) if to_auth is not None and 0<=to_auth<=disbursements else None)
        result[ident]={
          "receipts":receipts,"disbursements":disbursements,"cash_on_hand":cash,
          "transfers_from_authorized_committees":from_auth,
          "transfers_to_authorized_committees":to_auth,
          "receipts_excluding_internal_transfers":adjusted_receipts,
          "disbursements_excluding_internal_transfers":adjusted_disbursements,
          "report_end":r[27].strip() if len(r)>27 else None,
          "data_are_filing_summaries":True,
          "original_source":"Federal Election Commission All Candidates file weball26"
        }
    return result

def make_fec(fetch=get_bytes,now=None):
    now=now or NOW()
    candidate_rows=unzip_tabular(fetch(FEC_URLS["candidates"]),15)
    candidates=parse_fec_candidates(candidate_rows)
    rawfinancial=None
    financial_error=None
    try:
        rawfinancial=unzip_tabular(fetch(FEC_URLS["financials"]),30)
        finance=parse_fec_financials(rawfinancial,{c["id"] for c in candidates})
    except Exception as e:
        finance={}
        financial_error=str(e)[:180]
    for c in candidates:
        c["finance"]=finance.get(c["id"])
    house=[c for c in candidates if c["office"]=="H"]
    senate=[c for c in candidates if c["office"]=="S"]
    return {
      "status":"ok","collected_at":now.isoformat(timespec="seconds"),"cycle":CYCLE,
      "source":"Federal Election Commission (FEC) bulk downloads",
      "candidate_master_url":FEC_URLS["candidates"],"finance_url":FEC_URLS["financials"],
      "candidate_master_documentation":"https://www.fec.gov/campaign-finance-data/candidate-master-file-description/",
      "finance_documentation":"https://www.fec.gov/campaign-finance-data/all-candidates-file-description/",
      "house_count":len(house),"senate_count":len(senate),
      "house_districts_with_any_filing":len(set((c["state"],c["district"]) for c in house)),
      "house_districts_with_valid_current_id":len(set((c["state"],c["district"]) for c in house if c["district_within_2020_apportionment"])),
      "house_invalid_district_filings":sum(not c["district_within_2020_apportionment"] for c in house),
      "senate_states_with_any_filing":len({c["state"] for c in senate}),
      "finance_records_joined":sum(c["finance"] is not None for c in candidates),
      "finance_status":"ok" if finance else "unavailable_or_unmatched",
      "finance_error":financial_error,
      "candidates":candidates,
      "warning":"These are federal CANDIDATE FILINGS; they are NOT certified general-election ballot candidates, party nominees, or verified race matchups. Many filings can be inactive or obsolete. FEC money reports have varying coverage end dates and may double-count committee transfers.",
      "forecast_eligible":False
    }

def parse_census(rows):
    if not isinstance(rows,list) or not rows or len(rows)<400:raise ValueError("Census API rows missing or incomplete")
    expected=["NAME","B01003_001E","B19013_001E","B15003_001E","B15003_022E","B15003_023E","B15003_024E","B15003_025E","state","congressional district"]
    head=rows[0]
    missing=[k for k in expected if k not in head]
    if missing:raise ValueError("Census API schema mismatch: "+repr(missing))
    ix={h:i for i,h in enumerate(head)}
    out=[];seen=set()
    for r in rows[1:]:
        state=FIPS.get(r[ix["state"]])
        if not state:continue # DC and nonvoting districts excluded.
        cd=r[ix["congressional district"]]
        if not cd.isdigit():continue
        key=f"{state}-{int(cd):02d}"
        if key in seen:raise ValueError("Duplicate Census district: "+key)
        seen.add(key)
        pop=number(r[ix["B01003_001E"]])
        income=number(r[ix["B19013_001E"]])
        base=number(r[ix["B15003_001E"]])
        eds=[number(r[ix[v]]) for v in ["B15003_022E","B15003_023E","B15003_024E","B15003_025E"]]
        education_pct=round(100*sum(eds)/base,2) if base and all(v is not None and v>=0 for v in eds) else None
        out.append({"id":key,"state":state,"district":f"{int(cd):02d}",
                    "population_2020_2024_acs_est":pop if pop is not None and pop>=0 else None,
                    "median_household_income_est":income if income is not None and income>=0 else None,
                    "bachelors_plus_age25_pct_est":education_pct})
    return sorted(out,key=lambda d:d["id"])

def make_census(fetch=get_bytes,now=None):
    now=now or NOW()
    # All Census API data queries have required a free API key since May 2026.
    # The key stays in GitHub Actions secrets, never embedded in the public JSON.
    key=os.environ.get("CENSUS_API_KEY","").strip()
    if not key:
        raise ValueError("Census Bureau now requires a free CENSUS_API_KEY; none is configured in this GitHub Actions run")
    url=CENSUS_URL+"&key="+urllib.parse.quote(key,safe="")
    raw=fetch(url,3_000_000)
    try:
        parsed=json.loads(raw)
    except (ValueError,UnicodeDecodeError) as error:
        raise ValueError("Census API did not return JSON; first bytes: "+repr(raw[:250])) from error
    rows=parse_census(parsed)
    if len(rows)!=435:raise ValueError(f"2024 Census district coverage: {len(rows)} instead of 435")
    return {
      "status":"ok","collected_at":now.isoformat(timespec="seconds"),
      "source":"U.S. Census Bureau, American Community Survey 2020-2024 5-year",
      "source_url":CENSUS_URL,"geography":"119th Congress (2020 apportionment)",
      "district_count":len(rows),"districts":rows,
      "warning":"Census ACS figures are survey-based estimates with sampling error, not election results or predicted voting. Redistricting since the ACS district vintage must be resolved before 2026 model use.",
      "forecast_eligible":False
    }
def main():
    failures=[]
    for name,func in (("fec",make_fec),("census",make_census)):
        path=ROOT/f"politics-{name}-inputs.json"
        try:
            dataset=func()
            path.write_text(json.dumps(dataset,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
            print("Validated",name,"rows",len(dataset.get("candidates",dataset.get("districts",[]))))
        except Exception as e:
            failures.append({"source":name,"error":str(e)[:220]})
            print("Source failed; previous dataset untouched:",name,e,file=sys.stderr)
    status={"checked_at":NOW().isoformat(timespec="seconds"),
            "overall":"pass" if not failures else "partial","failed_sources":failures}
    (ROOT/"politics-input-source-status.json").write_text(json.dumps(status,indent=2)+"\n")
    return 0 if not failures else 1
if __name__=="__main__":sys.exit(main())

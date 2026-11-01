#!/usr/bin/env python3
"""Official no-key 2024 ACS 5-year congressional-district data, 119th Congress.

Public U.S. Census Bureau table-based summary-file releases, NOT the Census
API, are used. Parse 435 House districts only from all-geography datasets.
These *119th Congress* geographic estimates are NOT necessarily compatible
with redrawn *120th Congress/2026* district boundaries. No vote models.
"""
from __future__ import annotations
import csv
import datetime as dt
import hashlib
import io
import json
import pathlib
import re
import tempfile
import urllib.request
from scripts.politics_real_inputs import FIPS

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"politics-census-inputs.json"
BASE="https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/"
SOURCES={
    "B01003":("acsdt5y2024-b01003.dat",30_000_000,("B01003_E001","B01003_M001")),
    "B19013":("acsdt5y2024-b19013.dat",30_000_000,("B19013_E001","B19013_M001")),
    "B15003":("acsdt5y2024-b15003.dat",112_000_000,(
        "B15003_E001","B15003_E022","B15003_E023","B15003_E024","B15003_E025"))
}
CHANGED_2026_STATES=set("AL CA FL LA NC OH TN TX UT".split())
CD_RE=re.compile(r"^5001900US(\d{2})(\d{2})$")
EXPECTED_STATES=set(FIPS.values())
MISSING=set((-222222222,-333333333,-555555555,-666666666,-888888888,-999999999))

def numeric(value):
    try:
        n=int(str(value).strip())
    except (TypeError,ValueError):
        return None
    return n if n not in MISSING and n>=0 else None

def read_table(table, fetch=None):
    if table not in SOURCES:
        raise ValueError("Unsupported original Census detailed table")
    filename,limit,variables=SOURCES[table]
    url=BASE+filename
    tmp=tempfile.TemporaryFile()
    sha=hashlib.sha256()
    total=0
    try:
        if fetch is not None:
            blob=fetch(url)
            if not isinstance(blob,bytes):raise ValueError("Original Census response must be bytes")
            if len(blob)>limit:raise ValueError("Oversized original Census file")
            sha.update(blob)
            total=len(blob)
            tmp.write(blob)
        else:
            req=urllib.request.Request(url,headers={
                "User-Agent":"PoliticalLifeAndTimes/1.0 (free official 2024 ACS bulk research)",
                "Accept":"application/octet-stream, text/plain, */*"})
            with urllib.request.urlopen(req,timeout=75) as response:
                if response.status!=200:raise ValueError("Census bulk source HTTP "+str(response.status))
                while True:
                    part=response.read(1_048_576)
                    if not part:break
                    total+=len(part)
                    if total>limit:raise ValueError("Unexpectedly oversized Census source: "+table)
                    sha.update(part)
                    tmp.write(part)
        if total<100:raise ValueError("Empty/truncated Census bulk table "+table)
        tmp.seek(0)
        text=io.TextIOWrapper(tmp,encoding="utf-8-sig",errors="strict",newline="")
        reader=csv.DictReader(text,delimiter="|")
        if not reader.fieldnames or reader.fieldnames[0]!="GEO_ID" or any(v not in reader.fieldnames for v in variables):
            raise ValueError("Official Census table header does not match "+table)
        selected={}
        for row in reader:
            geo=row.get("GEO_ID","")
            matched=CD_RE.fullmatch(geo)
            if not matched:continue
            abbr=FIPS.get(matched.group(1))
            if not abbr:continue
            district=matched.group(2)
            if district=="98":continue
            if district=="00" and abbr not in {"AK","DE","ND","SD","VT","WY"}:
                raise ValueError("Unexpected at-large district in "+abbr)
            rid=abbr+"-"+district
            if rid in selected:raise ValueError("Duplicate congressional district "+rid+" in "+table)
            selected[rid]={v:numeric(row.get(v)) for v in variables}
        if len(selected)!=435:
            raise ValueError("Census "+table+" 119th Congress records "+str(len(selected))+"; expected 435")
        if {k[:2] for k in selected}!=EXPECTED_STATES:
            raise ValueError("Original Census record state coverage incomplete")
        return selected,{"url":url,"sha256":sha.hexdigest(),"bytes":total,"districts":len(selected)}
    finally:
        tmp.close()

def assemble(tables,source_info,previous=None,now=None):
    if set(tables)!=set(SOURCES):raise ValueError("Missing original 2024 ACS survey tables")
    if set(tables["B01003"])!=set(tables["B19013"]) or set(tables["B01003"])!=set(tables["B15003"]):
        raise ValueError("2024 Census population, income, education district keys are not congruent")
    if len(tables["B01003"])!=435:raise ValueError("Census district inventory must cover 435 seats")
    for table,entry in source_info.items():
        if table not in SOURCES or entry.get("url")!=BASE+SOURCES[table][0] or not re.fullmatch(r"[a-f0-9]{64}",entry.get("sha256","")):
            raise ValueError("Original Census bulk data provenance not verified")
    prior=previous or {}
    if prior.get("status")=="ok":
        old={k:v.get("sha256") for k,v in prior.get("source_files",{}).items()}
        current={k:v["sha256"] for k,v in source_info.items()}
        if old!=current:raise ValueError("Census official bulk file fingerprint changed since publication; require explicit source review")
    rows=[]
    for rid in sorted(tables["B01003"]):
        pop=tables["B01003"][rid]
        inc=tables["B19013"][rid]
        ed=tables["B15003"][rid]
        population=pop["B01003_E001"]
        if not isinstance(population,int) or not 150_000<=population<=2_200_000:
            raise ValueError("Missing/implausible 2024 ACS district population: "+rid)
        base=ed["B15003_E001"]
        components=[ed["B15003_E"+str(i).zfill(3)] for i in (22,23,24,25)]
        if not isinstance(base,int) or base<=0 or any(not isinstance(x,int) for x in components) or sum(components)>base:
            raise ValueError("Invalid Census educational attainment denominator: "+rid)
        state=rid[:2]
        income=inc["B19013_E001"]
        rows.append({
            "id":rid,"state":state,"district":rid[3:],
            "population_2020_2024_acs_est":population,
            "population_moe_est":pop["B01003_M001"],
            "median_household_income_est":income if income and income>0 else None,
            "median_household_income_moe_est":inc["B19013_M001"],
            "population_age25_and_over_est":base,
            "bachelors_plus_age25_pct_est":round(100*sum(components)/base,2),
            "bachelors_plus_pct_moe_not_recomputed":True,
            "boundary_vintage":"119th_Congress_2024",
            "2026_boundary_change_requires_remap":state in CHANGED_2026_STATES,
            "geographically_usable_as_2026_population":False,
        })
    if len(rows)!=435 or len({r["id"] for r in rows})!=435:raise ValueError("Census duplicate district IDs")
    now=now or dt.datetime.now(dt.timezone.utc)
    return {
        "status":"ok",
        "collected_at":prior.get("collected_at") if prior.get("status")=="ok" else now.isoformat(timespec="seconds"),
        "source":"U.S. Census Bureau, 2020–2024 American Community Survey 5-year, official detailed-table summary files",
        "source_url":BASE,
        "source_files":source_info,
        "geography":"119th Congress (2024 district vintage; not uniformly applicable to 2026)",
        "district_count":435,
        "districts":rows,
        "2026_boundary_changed_states":sorted(CHANGED_2026_STATES),
        "2026_district_geography_harmonized":False,
        "model_eligible":False,
        "forecast_eligible":False,
        "warning":"Original ACS 2020–2024 survey-based district estimates with sampling margins of error; NOT election returns or voting behavior. They describe 119th-Congress boundaries, not the new 2026 boundaries in nine redistricted states. No voter preferences, support margins, or 2026 probabilities are inferred."
    }

def main():
    prior={}
    try:prior=json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError,ValueError):pass
    tables={}
    sources={}
    for table in SOURCES:
        entries,source=read_table(table)
        tables[table]=entries
        sources[table]=source
        print("Official ACS table",table,"435 House districts","SHA256",source["sha256"],flush=True)
    dataset=assemble(tables,sources,prior)
    OUT.write_text(json.dumps(dataset,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("VALIDATED Census 2024 ACS:",dataset["district_count"],"districts; no API key; forecast approved:",dataset["forecast_eligible"])
if __name__=="__main__":main()

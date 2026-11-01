#!/usr/bin/env python3
"""Audit changes to Florida's original 2020 Census block-to-House district assignments.

2024 election uses the 2022 plan P000C0109; 2026 uses EOGPCRP2026.
Both original Florida Legislature files are 2020 Census block-equivalency
files, NOT 2024 vote returns, population, census demographics, or precincts.
Output is unweighted district-assignment geometry evidence only. No forecast.
"""
from __future__ import annotations
from collections import Counter
import csv
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"politics-fl-2024-2026-block-transition.json"
SOURCES={
    "2024":{
        "url":"https://edr.state.fl.us/Content/redistricting/2020redistricting/P000C0109.txt",
        "sha256":"588482ba862266702f7439c8804f5e0dad02444ae563ffb78e54e69e073a5188",
        "plan":"P000C0109",
    },
    "2026":{
        "url":"https://edr.state.fl.us/Content/redistricting/2026redistricting/EOGPCRP2026.txt",
        "sha256":"ae520c0ace210f87af6bfc11016fbfc7d3a90174441020deaa52c0c20e0fdc40",
        "plan":"EOGPCRP2026",
    },
}
FL_DISTRICTS={f"{i:02d}" for i in range(1,29)}
EXPECTED_BLOCK_PREFIX="12"
MAX_BYTES=10_000_000

def get_bytes(url):
    if url not in {x["url"] for x in SOURCES.values()}:
        raise ValueError("Unapproved state government block file")
    request=urllib.request.Request(url,headers={
        "User-Agent":"Political-Life-and-Times/1.0 (source-linked public geographic research)",
        "Accept":"text/plain, */*"
    })
    with urllib.request.urlopen(request,timeout=50) as response:
        if response.status!=200:
            raise ValueError(f"Original Florida Legislature source status {response.status}")
        blob=response.read(MAX_BYTES+1)
        if not blob or len(blob)>MAX_BYTES:
            raise ValueError("Unexpected Florida block file size")
        return blob

def parse_block_file(blob, min_rows=200_000):
    if not isinstance(blob,bytes):
        raise ValueError("Require original source bytes")
    try:
        raw=blob.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise ValueError("Unexpected Florida block encoding") from e
    result={}
    counts=Counter()
    reader=csv.reader(io.StringIO(raw),delimiter=",",strict=True)
    for line_no,row in enumerate(reader,1):
        if not row or (len(row)==1 and not row[0].strip()):
            continue
        if len(row)!=2:
            raise ValueError(f"Unexpected Florida BEF fields at line {line_no}")
        block=row[0].strip()
        label=row[1].strip()
        if not re.fullmatch(r"12\d{13}",block):
            raise ValueError(f"Invalid 15-digit Florida 2020 Census block at line {line_no}")
        if not re.fullmatch(r"\d{1,2}",label):
            raise ValueError(f"Invalid Florida congressional district at line {line_no}")
        district=label.zfill(2)
        if district not in FL_DISTRICTS:
            raise ValueError(f"Invalid district identifier at line {line_no}")
        if block in result:
            raise ValueError(f"Duplicate 2020 Census block at line {line_no}")
        result[block]=district
        counts[district]+=1
    if len(result)<min_rows:
        raise ValueError(f"Incomplete 2020 Census block assignment: {len(result)}")
    return result,counts

def compare_blocks(before,after):
    if set(before)!=set(after):
        raise ValueError(f"2024/2026 block inventory differs: 2024_only={len(set(before)-set(after))}, 2026_only={len(set(after)-set(before))}; no percentage is safe")
    counts=Counter((before[k],after[k]) for k in before)
    old_by=Counter(before.values())
    new_by=Counter(after.values())
    moved=sum(n for (old,new),n in counts.items() if old!=new)
    return {
        "total_2020_census_blocks":len(before),
        "blocks_assigned_to_different_numbered_district":moved,
        "blocks_assigned_to_same_numbered_district":len(before)-moved,
        "pct_blocks_assignment_changed_unweighted":round(100*moved/len(before),4),
        "matrix":[{"district_2024":a,"district_2026":b,"2020_blocks":n}
                  for (a,b),n in sorted(counts.items())],
        "districts_2026":[{
            "district_2026":d,"2020_blocks":new_by[d],
            "2020_blocks_from_other_2024_districts":sum(n for (old,new),n in counts.items() if new==d and old!=new),
            "2020_blocks_same_number":counts.get((d,d),0),
            "pct_2026_blocks_from_other_numbered_districts_unweighted":
                round(100*sum(n for (old,new),n in counts.items() if new==d and old!=new)/new_by[d],4) if new_by[d] else None,
            "presidential_2024_votes_on_2026_boundary":None,
            "population_reweighted":False,
            "2026_district_vote_baseline_certified":False
        } for d in sorted(FL_DISTRICTS)]
    }

def build(fetch=get_bytes, now=None):
    inputs={}
    for vintage,item in SOURCES.items():
        raw=fetch(item["url"])
        digest=hashlib.sha256(raw).hexdigest()
        if digest!=item["sha256"]:
            raise ValueError("Official Florida "+vintage+" source fingerprint changed; review new data before replacing previously validated output")
        blocks,counts=parse_block_file(raw)
        if set(counts)!=FL_DISTRICTS:
            raise ValueError("Florida "+vintage+" plan missing at least one of 28 congress districts")
        inputs[vintage]={"raw":raw,"blocks":blocks,"count_by_district":counts}
    compared=compare_blocks(inputs["2024"]["blocks"],inputs["2026"]["blocks"])
    return {
        "status":"OFFICIAL_BLOCK_REASSIGNMENTS_VERIFIED_NOT_VOTE_RESULTS",
        "source_verified_at":(now or dt.datetime.now(dt.timezone.utc)).isoformat(timespec="seconds"),
        "state":"FL",
        "plans":{"2024":{"plan":SOURCES["2024"]["plan"],"url":SOURCES["2024"]["url"],"sha256":SOURCES["2024"]["sha256"]},
                 "2026":{"plan":SOURCES["2026"]["plan"],"url":SOURCES["2026"]["url"],"sha256":SOURCES["2026"]["sha256"]}},
        "2020_census_block_vintage_aligned":True,
        "source_block_inventory_identical":True,
        "congressional_districts_each_plan":28,
        "comparison":compared,
        "metric_warning":"Block reassignment counts are UNWEIGHTED geographic assignment counts, not population, voter share, votes, land area or party swing.",
        "2024_presidential_vote_retabulated_on_2026_boundaries":False,
        "precinct_to_2026_district_voting_crosswalk_certified":False,
        "forecast_eligible":False,
        "certified_2026_probability_count":0,
        "warning":"Florida 2024 and 2026 official legislative 2020 Census block assignments can now be compared, but 2024 election precinct geography, split precincts, presidential returns and voter allocation have not been reconciled. No district baseline, vote or forecast may be computed from unweighted block counts."
    }

def main():
    output=build()
    OUTPUT.write_text(json.dumps(output,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    c=output["comparison"]
    print("Official Florida block crosswalk:",c["total_2020_census_blocks"],"blocks;",
          c["blocks_assigned_to_different_numbered_district"],"moved across numbered district assignments;",
          "2024 votes mapped: NO; independent 2026 odds: 0")
if __name__=="__main__":main()

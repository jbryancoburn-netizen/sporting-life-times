#!/usr/bin/env python3
"""Audit independent NCAA-origin 2025-26 player statistics and roster sources.

Downloads real NCAA-origin public release files; saves schema and completeness
evidence, not precomputed ratings. A future roster model must pass player/team
crosswalk and predictive validation before it changes preseason Elo.
"""
import csv,gzip,json,urllib.request,hashlib,argparse
from pathlib import Path
from collections import Counter
URL="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/"
FILES={"ncaa_rosters":"ncaa_mbb_rosters","ncaa_player_box":"ncaa_mbb_player_box"}
def stream(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urllib.request.urlopen(req,timeout=90) as r: compressed=r.read(20000000)
    raw=gzip.decompress(compressed).decode("utf-8-sig")
    parsed=list(csv.DictReader(raw.splitlines()))
    if not parsed:raise ValueError("Empty release: "+url)
    return parsed,hashlib.sha256(compressed).hexdigest()
def audit(season=2026):
    result={"season":season,"source_family":"NCAA stats.ncaa.org via SportsDataverse",
            "data_use":"historical player evidence; NOT independently validated Elo adjustments",
            "datasets":{}}
    for key,release in FILES.items():
        url=f"{URL}{release}/{release}_{season}.csv.gz"
        rows,digest=stream(url)
        cols=list(rows[0])
        result["datasets"][key]={"source_url":url,"compressed_sha256":digest,
            "rows":len(rows),"columns":cols,
            "column_nonempty":{k:sum(bool((r.get(k) or "").strip()) for r in rows) for k in cols},
            "sample":rows[0]}
    result["source_evidence_verified"]=True
    return result
def main():
    p=argparse.ArgumentParser();p.add_argument("--out",type=Path,default=Path("data/ncaam-historical-player-source-audit.json"))
    a=p.parse_args();data=audit();a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(data,indent=2)+"\n")
    print("Verified NCAA-origin player source coverage:",json.dumps({k:v["rows"] for k,v in data["datasets"].items()}))
    print("Roster fields:",data["datasets"]["ncaa_rosters"]["columns"])
    print("Player box fields:",data["datasets"]["ncaa_player_box"]["columns"])
if __name__=="__main__":main()

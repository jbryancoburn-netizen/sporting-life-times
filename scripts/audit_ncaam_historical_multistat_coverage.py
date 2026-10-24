#!/usr/bin/env python3
"""Measure real historical NCAA box-score stat availability before fitting new player value.

No guessed stats, no fabricated TS%, no production ranking changes.
"""
import argparse,csv,gzip,json,math
from collections import Counter
from pathlib import Path

METRICS=("pts","mins","fgm","fga","fg3m","fg3a","ftm","fta","oreb","dreb","reb","ast","tov","stl","blk")
def usable(s):
    try:
        v=float(s)
        return math.isfinite(v) and v>=0
    except (TypeError,ValueError):return False
def audit(root):
    result={}
    for year in (2023,2024,2025,2026):
        path=root/f"ncaa_mbb_player_box_{year}.csv.gz"
        valid=Counter();rows=0
        with gzip.open(path,"rt",encoding="utf8",newline="") as f:
            reader=csv.DictReader(f)
            available=set(reader.fieldnames or ())
            for record in reader:
                rows+=1
                for stat in METRICS:
                    if stat in available and usable(record.get(stat)):valid[stat]+=1
        result[str(year)]={"rows":rows,"available_columns":[x for x in METRICS if x in available],
            "nonnegative_numeric_rows":dict(valid),
            "coverage":{stat:round(valid[stat]/rows,6) for stat in METRICS}}
    return {"status":"SOURCE_COVERAGE_AUDIT_NOT_A_PREDICTIVE_MODEL","years":result,
        "production_elo_changed":False,
        "next_step":"Only build multistat predictors for columns with verified source coverage; compare chronologically"}
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--source",type=Path,required=True)
    p.add_argument("--out",type=Path,default=Path("historical-report/ncaam-historical-multistat-coverage.json"))
    a=p.parse_args();r=audit(a.source);a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(r,indent=2)+"\n")
    print(json.dumps({y:{"rows":d["rows"],"coverage":d["coverage"]} for y,d in r["years"].items()},indent=2))

#!/usr/bin/env python3
"""Independent generic-ballot polling average using public VoteHub poll records.
This is NOT a district forecast or a chamber-control model.
License: VoteHub polling API CC BY 4.0, https://votehub.com/polls/api/.
"""
from __future__ import annotations
import datetime as dt
import json
import math
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "politics-polls.json"
AUDIT = ROOT / "politics-poll-health.json"
UTC = dt.timezone.utc
API = "https://api.votehub.com/polls"
SOURCE = "https://votehub.com/polls/api/"

def numerical(value):
    try:
        f = float(value)
        return f if math.isfinite(f) else None
    except (ValueError, TypeError):
        return None

def classify(choice):
    choice = str(choice or "").strip().lower()
    if choice in ("dem", "democrat", "democrats", "democratic", "democratic party"): return "D"
    if choice in ("rep", "gop", "republican", "republicans", "republican party"): return "R"
    return None

def average(raw_polls, today: dt.date, lookback=35):
    # One retained poll per pollster/end date; prevents duplicate data overweighting.
    best = {}
    exclusions = {"missing_fields":0,"outside_window":0,"partisan":0,"duplicate":0}
    for p in raw_polls:
        if p.get("poll_type") != "generic-ballot":
            continue
        if p.get("partisan") or p.get("internal"):
            exclusions["partisan"] += 1
            continue
        try:
            end = dt.date.fromisoformat(str(p["end_date"])[:10])
        except (KeyError, TypeError, ValueError):
            exclusions["missing_fields"] += 1; continue
        age = (today - end).days
        n = numerical(p.get("sample_size"))
        if not 0 <= age <= lookback:
            exclusions["outside_window"] += 1; continue
        if n is None or not 250 <= n <= 50000:
            exclusions["missing_fields"] += 1; continue
        pollster = str(p.get("pollster") or "").strip()
        if not pollster:
            exclusions["missing_fields"] += 1; continue
        vals = {}
        for a in p.get("answers") or []:
            party = classify(a.get("choice"))
            val = numerical(a.get("pct"))
            if party and val is not None and 0 <= val <= 100:
                vals[party] = val
        if "D" not in vals or "R" not in vals or vals["D"] + vals["R"] > 101:
            exclusions["missing_fields"] += 1; continue
        # Survey population and age adjustments, explicitly not pollster-quality grading.
        population = str(p.get("population") or "").lower()
        population_weight = {"lv":1.15,"rv":1.0,"a":0.85}.get(population,0.8)
        weight = math.sqrt(min(2500,n)/1000)*0.5**(age/14.0)*population_weight
        row = {"id":str(p.get("id") or ""),"pollster":pollster,"end_date":end.isoformat(),
            "sample_size":int(n),"population":population,"dem":vals["D"],"rep":vals["R"],
            "weight":weight,"source_url":str(p.get("url") or ""),"age_days":age}
        key=(pollster.casefold(),end.isoformat())
        if key in best:
            exclusions["duplicate"] += 1
            if best[key]["sample_size"] >= n: continue
        best[key] = row
    rows = sorted(best.values(), key=lambda x:x["end_date"],reverse=True)
    firms = len({row["pollster"].casefold() for row in rows})
    if len(rows)<3 or firms<3:
        return {"status":"insufficient_polling","poll_count":len(rows),"pollsters":firms,
                "exclusions":exclusions,"average":None,"polls":rows[:40]}
    denom=sum(row["weight"] for row in rows)
    dem=sum(row["dem"]*row["weight"] for row in rows)/denom
    rep=sum(row["rep"]*row["weight"] for row in rows)/denom
    return {"status":"ok","poll_count":len(rows),"pollsters":firms,"exclusions":exclusions,
        "average":{"dem":round(dem,2),"rep":round(rep,2),"dem_margin":round(dem-rep,2)},
        "polls":rows[:40]}

def fetch_polling(today):
    params=urllib.parse.urlencode({"poll_type":"generic-ballot","from_date":(today-dt.timedelta(days=35)).isoformat()})
    req=urllib.request.Request(API+"?"+params,headers={"User-Agent":"The-Political-Life-and-Times/1.0 (source attribution; no redistribution of articles)","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=22) as response:
        if response.status!=200:raise ValueError("polls endpoint returned "+str(response.status))
        body=response.read(8_000_001)
        if len(body)>8_000_000:raise ValueError("Poll feed unexpectedly large")
    blob=json.loads(body)
    if isinstance(blob,list):return blob
    if isinstance(blob,dict) and isinstance(blob.get("polls"),list):return blob["polls"]
    raise ValueError("Unexpected VoteHub schema")

def main():
    now=dt.datetime.now(UTC)
    try:
        records=fetch_polling(now.date())
        result=average(records,now.date())
        # Always publish a transparent source-coverage audit, including failures.
        # No provisional average is published when the minimum coverage gate fails.
        audit={
            "checked_at":now.isoformat(timespec="seconds"),
            "source":"VoteHub polling API", "source_url":SOURCE,
            "status":result["status"], "raw_poll_records":len(records),
            "eligible_polls":result["poll_count"], "unique_pollsters":result["pollsters"],
            "minimum_pollsters":3, "window_days":35,
            "exclusions":result["exclusions"],
            "latest_eligible_poll_end_date":max((p["end_date"] for p in result["polls"]),default=None),
            "message":"Insufficient eligible polling organizations; no independent average is certified." if result["status"]!="ok" else "Minimum source threshold passed; independent average published."
        }
        AUDIT.write_text(json.dumps(audit,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    except (OSError,ValueError,TimeoutError) as error:
        AUDIT.write_text(json.dumps({"checked_at":now.isoformat(timespec="seconds"),"status":"source_error","source":"VoteHub polling API","detail":str(error)[:160]},indent=2)+"\n",encoding="utf-8")
        print("Unable to retrieve valid polling data; leaving prior report intact:",error,file=sys.stderr)
        return 1
    result.update({"computed_at":now.isoformat(timespec="seconds"),"model":"USRS independent national generic-ballot polling average v1",
        "category":"polling average; not election prediction",
        "source":"VoteHub polling API","source_url":SOURCE,"license":"CC BY 4.0",
        "method":"Nonpartisan public polls from previous 35 days; weight sqrt(capped sample size) × 14-day half-life × population factor (LV 1.15, RV 1.0, A 0.85, unknown 0.8). Retain at most one poll per pollster/day. Min 3 distinct polling organizations. No pollster-grade weights or house-effects correction yet.",
        "limitations":"National generic ballot does not identify individual district results, seat probabilities, or a vote forecast. Exclusions and input sample are disclosed."})
    if result["status"]!="ok":
        print("Insufficient polls; not replacing published validated report:",result["poll_count"],result["pollsters"],file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Own poll average updated:",result["average"],"firms:",result["pollsters"],"polls:",result["poll_count"])
    return 0
if __name__=="__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""NCAA-origin 2025-26 player workload compared to 2026-27 ESPN roster evidence.

School and player matching are exact after case/punctuation normalization;
ambiguous/missing records never count as departures. Output remains diagnostic,
not an authorized Elo change or a statistical assertion about player quality.
"""
import csv,gzip,json,re,urllib.request
from collections import defaultdict
from pathlib import Path

URL="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/ncaa_mbb_player_box/ncaa_mbb_player_box_2026.csv.gz"
def norm(s):return re.sub("[^a-z0-9]","",str(s or "").lower().replace("&","and"))
def rows():
    req=urllib.request.Request(URL,headers={"User-Agent":"SportingLifeTimes/1.0"})
    with urllib.request.urlopen(req,timeout=120) as r:data=r.read(20000000)
    return csv.DictReader(gzip.decompress(data).decode("utf-8-sig").splitlines())
def audit(stats,current,registry):
    schools={norm(t["name"]):t["id"] for t in registry["teams"]}
    if len(schools)!=len(registry["teams"]):raise ValueError("School collision")
    mins=defaultdict(float);names={}
    for record in stats:
        team=schools.get(norm(record.get("team")))
        if not team:continue
        person=norm(record.get("clean_name") or record.get("player"))
        if not person:continue
        try:m=float(record.get("mins") or 0)
        except ValueError:continue
        if not 0<=m<=75:continue
        key=(team,person);mins[key]+=m;names[key]=record.get("clean_name") or record.get("player")
    outputs=[]
    for roster in current["rosters"]:
        team=roster["ncaa_id"]
        active={norm(p["name"]) for p in roster["players"] if norm(p.get("name"))}
        eligible=[(p,m) for (tid,p),m in mins.items() if tid==team]
        total=sum(m for _,m in eligible)
        retained=sum(m for p,m in eligible if p in active)
        outputs.append({"team_id":team,"team":roster["school"],
                        "prior_minutes":round(total,1),
                        "matched_returning_minutes":round(retained,1),
                        "minutes_retention_ratio":round(retained/total,4) if total>0 else None,
                        "matching_method":"exact normalized player names within verified team ID",
                        "match_status":"needs alias and transfer audit"})
    valid=[r for r in outputs if r["prior_minutes"]>0]
    return {"season":"2026-27","previous_season":"2025-26",
            "ncaa_origin_stats":URL,"current_roster_origin":"ESPN secondary evidence",
            "teams_with_current_roster":len(outputs),
            "teams_with_historical_minutes":len(valid),
            "teams_without_verified_join":[x["team"] for x in outputs if not x["prior_minutes"]],
            "teams":outputs,
            "authorized_for_elo_adjustment":False,
            "note":"Exact-name match is lower-bound observed retention; missing aliases/rosters must be reconciled, coefficients calibrated."}
def main():
    source=Path("staging/ncaam-2027-roster-evidence.json")
    root=Path("data")
    current=json.loads(source.read_text())
    registry=json.loads((root/"ncaam-2026-27-team-registry.json").read_text())
    result=audit(rows(),current,registry)
    target=root/"ncaam-2026-27-minutes-retention-audit.json"
    target.write_text(json.dumps(result,indent=2)+"\n")
    print("2026-27 current rosters:",result["teams_with_current_roster"],
          "historical team minutes matched:",result["teams_with_historical_minutes"])
if __name__=="__main__":main()

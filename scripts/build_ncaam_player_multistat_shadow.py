#!/usr/bin/env python3
"""Source-linked 2025-26 NCAA player box impact components, research only.

Never impute missing box columns. Joins require pinned NCAA player ID AND
source-school ID. These statistics are descriptive, not calibrated Elo.
"""
import argparse,csv,gzip,json,math
from collections import defaultdict
from pathlib import Path

METRICS={"points":("pts",),"rebounds":("reb","rebounds","treb"),
         "assists":("ast","assists"),"turnovers":("to","tov","turnovers"),
         "steals":("stl","steals"),"blocks":("blk","blocks")}
def parse_count(value):
    try: n=float(value)
    except (ValueError,TypeError):return None
    return n if math.isfinite(n) and 0<=n<=100 else None
def value(row,aliases):
    for k in aliases:
        if k in row and row[k] not in ("",None):
            return parse_count(row[k])
    return None
def aggregate(rows,links,movement):
    athletes={str(p["current_id"]):(t["team_id"],p)
              for t in movement["teams"] for p in t["players"]}
    xwalk={}
    for l in links["links"]:
        eid=str(l["id"])
        if eid not in athletes or l.get("method") not in ("name_jersey","last_jersey","name"):continue
        _,p=athletes[eid]
        if p.get("prior_school_id")!=l.get("prior"):continue
        key=(str(l["pid"]),l["prior"])
        if key in xwalk:raise ValueError("Ambiguous NCAA player+school source key "+str(key))
        xwalk[key]=eid
    out=defaultdict(lambda:{"minutes":0.,"games":set(),"totals":defaultdict(float),"available":defaultdict(int)})
    seen=set();rejected=defaultdict(int)
    for row in rows:
        source=str(row.get("team_ncaa_team_id") or "")
        pid=str(row.get("player_id") or "")
        gid=str(row.get("contest_id") or "")
        if not gid or not source or not pid:rejected["invalid_id"]+=1;continue
        key=(pid,"ncaa:"+source)
        eid=xwalk.get(key)
        if eid is None:rejected["unmatched_identity"]+=1;continue
        gkey=(eid,gid)
        if gkey in seen:raise ValueError("Duplicate player/contest row "+str(gkey))
        seen.add(gkey)
        mins=parse_count(row.get("mins"))
        if mins is None or mins<=0 or mins>75:rejected["invalid_minutes"]+=1;continue
        v=out[eid];v["minutes"]+=mins;v["games"].add(gid)
        for metric,aliases in METRICS.items():
            n=value(row,aliases)
            if n is not None:
                v["totals"][metric]+=n;v["available"][metric]+=1
    result=[]
    for eid,v in sorted(out.items()):
        result.append({"current_player_id":eid,"minutes":round(v["minutes"],2),
          "games":len(v["games"]),
          "totals":{k:round(v["totals"][k],2) if v["available"][k]==len(v["games"]) else None for k in METRICS},
          "complete_game_stat_coverage":{k:v["available"][k]==len(v["games"]) for k in METRICS}})
    return {"season":"2026-27","historical_season":"2025-26",
      "status":"RESEARCH_ONLY_UNCALIBRATED_MULTI_STAT",
      "production_elo_approved":False,
      "linked_athletes":len(result),"metrics":list(METRICS),
      "source_match_policy":"exact NCAA historical player ID and source school; no fuzzy join",
      "missing_stat_policy":"null if any eligible game lacks that stat; never treat missing as zero",
      "rejected":dict(rejected),"players":result}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--box",required=True,type=Path)
    ap.add_argument("--data",type=Path,default=Path("data"))
    ap.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-player-multistat-shadow.json"))
    args=ap.parse_args()
    def read(name):return json.loads((args.data/name).read_text())
    with gzip.open(args.box,"rt",encoding="utf-8-sig",newline="") as f:
        result=aggregate(csv.DictReader(f),read("ncaam-2026-27-direct-player-crosswalk.json"),
          read("ncaam-2026-27-player-movement-audit.json"))
    if result["linked_athletes"]<1000:raise ValueError("Insufficient verified multi-stat identities")
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k!="players"},indent=2))
if __name__=="__main__":main()

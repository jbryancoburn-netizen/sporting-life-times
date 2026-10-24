#!/usr/bin/env python3
"""Rebuild 2026-27 player-value v1 shadow from pinned primary datasets.
Research-only: prior scoring/minutes, not yet opponent adjusted or backtested.
"""
import json, math, argparse
from pathlib import Path

def load(path): return json.loads(path.read_text(encoding="utf-8"))
def median(xs):
    s=sorted(xs); n=len(s)
    return (s[(n-1)//2]+s[n//2])/2

def build(movement,cross,baseline):
    links={str(x["id"]):x for x in cross["links"]}
    bases={x["team_id"]:x for x in baseline["rankings"]}
    def eligible(p):
        l=links.get(str(p["current_id"]))
        return bool(l and l["method"]!="jaro_winkler" and p.get("prior_school_id")
            and l.get("prior")==p["prior_school_id"]
            and isinstance(p.get("prior_minutes"),(int,float)) and p["prior_minutes"]>0
            and isinstance(p.get("prior_games"),(int,float)) and p["prior_games"]>0
            and isinstance(p.get("prior_points"),(int,float)) and p["prior_points"]>=0)
    all_players=[p for t in movement["teams"] for p in t["players"]]
    eligible_players=[p for p in all_players if eligible(p)]
    mean=sum(p["prior_points"]/p["prior_minutes"] for p in eligible_players)/len(eligible_players)
    rows=[]
    for team in movement["teams"]:
        players=[]
        for p in team["players"]:
            valid=eligible(p)
            if not valid:
                players.append({"id":p["current_id"],"player":p["player"],"valid":False,"projected_mpg":0.0,"value":mean})
                continue
            mpg=min(40,p["prior_minutes"]/p["prior_games"])
            rate=p["prior_points"]/p["prior_minutes"]
            shrink=min(1,p["prior_minutes"]/(p["prior_minutes"]+500))
            players.append({"id":p["current_id"],"player":p["player"],"valid":True,
                "prior_team":p["prior_school_id"],"projected_mpg":mpg,
                "raw_ppm":rate,"value":mean+shrink*(rate-mean)})
        valid=[p for p in players if p["valid"]]
        total=sum(p["projected_mpg"] for p in valid)
        scale=200/total if total>200 else 1
        captured=sum(p["projected_mpg"]*scale for p in valid)
        index=sum(p["projected_mpg"]*scale*(p["value"]-mean) for p in valid)/200
        base=bases[team["team_id"]]["elo"]
        rows.append({"team_id":team["team_id"],"team":team["team"],"baseline_elo":base,
            "verified_players":len(valid),"projected_verified_minutes":round(captured,2),
            "unmodeled_minutes":round(200-captured,2),
            "player_quality_index":round(index,6),
            "returners":sum(p["prior_team"]==team["team_id"] for p in valid),
            "transfers":sum(p["prior_team"]!=team["team_id"] for p in valid)})
    center=median([r["player_quality_index"] for r in rows])
    for r in rows:
        delta=round(300*(r["player_quality_index"]-center),4)
        r["experimental_quality_adjustment"]=delta
        r["elo"]=round(r["baseline_elo"]+delta,4)
    rows.sort(key=lambda r:(-r["elo"],r["team_id"]))
    for i,r in enumerate(rows,1):r["rank"]=i
    return rows

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--data",type=Path,default=Path("data"))
    args=ap.parse_args()
    d=args.data
    expected=load(d/"ncaam-2026-27-player-value-experimental-v1.json")
    actual=build(load(d/"ncaam-2026-27-player-movement-audit.json"),
      load(d/"ncaam-2026-27-direct-player-crosswalk.json"),
      load(d/"ncaam-2026-27-preseason-provisional.json"))
    assert actual==expected["rankings"], "Published research rankings do not reproduce"
    assert expected["production_elo_approved"] is False
    print("PASS: independently regenerated all 365 experimental NCAA player-value Elo records")
if __name__=="__main__":main()

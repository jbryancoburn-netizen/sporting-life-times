#!/usr/bin/env python3
"""Deterministic Australian NBL Elo engine. Inputs: audited chronological finals.
No ratings are published unless the complete prior-season baseline is certified.
"""
import argparse, hashlib, json, math
from datetime import datetime, timezone
from pathlib import Path

TEAMS = ("Adelaide 36ers","Brisbane Bullets","Cairns Taipans","Illawarra Hawks",
         "Melbourne United","New Zealand Breakers","Perth Wildcats",
         "South East Melbourne Phoenix","Sydney Kings","Tasmania JackJumpers")
K = 20.0
HOME = 65.0
REGRESSION = 0.25

def model(baseline, games):
    if not baseline.get("certified") or set(baseline.get("ratings", {})) != set(TEAMS):
        raise ValueError("Full certified 10-team preseason baseline required")
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in baseline["ratings"].values()):
        raise ValueError("Baseline ratings must be finite numbers")
    ratings = {k: 1500 + (float(v)-1500)*(1-REGRESSION) for k,v in baseline["ratings"].items()}
    seen=set()
    ledger=[]
    prev=""
    for g in games:
        gid=str(g.get("id",""))
        if not gid or gid in seen: raise ValueError("Missing/duplicate game ID: "+gid)
        seen.add(gid)
        if not g.get("verified") or not g.get("source_url") or not g.get("played_at"):
            raise ValueError("Unverified or undocumented game: "+gid)
        if prev and g["played_at"] < prev: raise ValueError("Finals not chronological")
        prev=g["played_at"]
        home,away=g["home"],g["away"]
        if home==away or home not in ratings or away not in ratings:
            raise ValueError("Unknown or duplicated team: "+gid)
        hs,as_=g["home_score"],g["away_score"]
        if not isinstance(hs,int) or not isinstance(as_,int) or min(hs,as_)<0 or hs==as_:
            raise ValueError("Invalid final scores: "+gid)
        h0,a0=ratings[home],ratings[away]
        p=1/(1+10**((a0-h0-HOME)/400))
        delta=K*((1 if hs>as_ else 0)-p)
        ratings[home]+=delta
        ratings[away]-=delta
        ledger.append({"id":gid,"played_at":g["played_at"],"home":home,"away":away,
          "home_score":hs,"away_score":as_,"home_win_probability":round(p,5),
          "home_elo_before":round(h0,2),"away_elo_before":round(a0,2),
          "elo_change":round(delta,2),"source_url":g["source_url"]})
    return {"model":"nbl-elo-v1","status":"calculated",
      "parameters":{"k":K,"home_advantage_elo":HOME,"offseason_regression":REGRESSION},
      "season":baseline.get("season","2026-27"),"baseline_source":baseline.get("source_url"),
      "games_processed":len(ledger),"ratings":[{"team":team,"elo":round(ratings[team],2)} for team in sorted(TEAMS,key=lambda t:(-ratings[t],t))],
      "recent_results":ledger[-20:]}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--baseline",default="data/nbl-elo-baseline.json")
    parser.add_argument("--games",default="data/nbl-final-ledger.json")
    parser.add_argument("--output",default="data/nbl-elo.json")
    args=parser.parse_args()
    baseline=json.loads(Path(args.baseline).read_text())
    games=json.loads(Path(args.games).read_text())
    try:
        result=model(baseline,games["games"])
    except ValueError as ex:
        result={"model":"nbl-elo-v1","status":"withheld","reason":str(ex),
          "games_in_ledger":len(games.get("games",[])),"season":"2026-27",
          "ratings":[],"recent_results":[]}
    Path(args.output).write_text(json.dumps(result,indent=2)+"\n")
    print(result["status"],result.get("reason",""),"games",result.get("games_processed",0))
    if result["status"]!="calculated": raise SystemExit(2)
if __name__=="__main__": main()

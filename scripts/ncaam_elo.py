#!/usr/bin/env python3
"""Sporting Life & Times independent men's Division I college basketball Elo.

Input CSV columns: game_id,date,home_id,away_id,home_score,away_score,site,status,source_url,provider
site: home|neutral (home_id is designated home even at neutral sites).
Input team JSON: {"teams":[{"id":"stable-id","name":"Team","division":"D1", "conference":"..."}]}
Optional prior JSON: output from this engine's previous completed season.
No third-party Elo is ever imported. No inferred games or unknown opponents.
"""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

MODEL = "slat-ncaam-d1-elo-v1"
PARAMETERS = {"base":1500.0,"k":24.0,"home_advantage":65.0,
              "mov_coefficient":0.55,"carryover":0.65,
              "overtime_factor":0.85,"points_per_elo":25.0}
REQUIRED = {"game_id","date","home_id","away_id","home_score","away_score",
            "site","status","source_url","provider"}

def probability(home, away, neutral=False, params=PARAMETERS):
    diff=home-away+(0 if neutral else params["home_advantage"])
    return 1/(1+10**(-diff/400))

def validate_teams(raw):
    teams=raw.get("teams",[])
    if not teams or len({t["id"] for t in teams})!=len(teams):
        raise ValueError("Nonempty unique-ID team registry required")
    for t in teams:
        if not t.get("name") or t.get("division")!="D1":
            raise ValueError("Every registered team must be identified as men's D1")
    return {t["id"]:t for t in teams}

def load_games(path, teams):
    with open(path, newline="", encoding="utf-8") as stream:
        reader=csv.DictReader(stream)
        if not REQUIRED.issubset(reader.fieldnames or []):
            raise ValueError("Missing game columns: "+",".join(sorted(REQUIRED-set(reader.fieldnames or []))))
        rows=list(reader)
    seen=set()
    games=[]
    for r in rows:
        gid=r["game_id"].strip()
        if not gid or gid in seen: raise ValueError("Duplicate/empty game_id: "+gid)
        seen.add(gid)
        if r["status"].strip().lower() not in {"final","completed"}:
            continue
        if not r["source_url"].startswith("https://") or not r["provider"].strip():
            raise ValueError("Final without attributable HTTPS source: "+gid)
        home,away=r["home_id"].strip(),r["away_id"].strip()
        if home==away or home not in teams or away not in teams:
            raise ValueError("Unknown or duplicate D1 participants: "+gid)
        if r["site"] not in {"home","neutral"}:
            raise ValueError("Ambiguous venue: "+gid)
        try:
            day=date.fromisoformat(r["date"])
            hs,aws=int(r["home_score"]),int(r["away_score"])
        except (ValueError, TypeError) as exc:
            raise ValueError("Invalid final date/scores: "+gid) from exc
        if hs<0 or aws<0 or hs==aws: raise ValueError("Invalid basketball final: "+gid)
        games.append({"id":gid,"date":day.isoformat(),"home":home,"away":away,
                      "home_score":hs,"away_score":aws,"site":r["site"],
                      "source_url":r["source_url"],"provider":r["provider"],
                      "overtime":str(r.get("overtime","")).strip().lower() in {"1","true","yes"}})
    games.sort(key=lambda x:(x["date"],x["id"]))
    return games

def compute(teams,games,season,prior=None,params=PARAMETERS):
    ids=sorted(teams)
    previous=(prior or {}).get("ratings",{})
    if prior and (prior.get("model")!=MODEL or set(previous)!=set(ids)):
        raise ValueError("Previous-season model/roster mismatch: migration must be explicit")
    start={i:params["base"]+params["carryover"]*(float(previous[i])-params["base"]) if prior else params["base"] for i in ids}
    ratings=start.copy()
    ledger=[]
    for g in games:
        h,a=g["home"],g["away"]
        ph=probability(ratings[h],ratings[a],g["site"]=="neutral",params)
        margin=abs(g["home_score"]-g["away_score"])
        multiplier=1+params["mov_coefficient"]*math.log1p(margin)/math.log(10)
        if g["overtime"]: multiplier*=params["overtime_factor"]
        shift=params["k"]*multiplier*((1 if g["home_score"]>g["away_score"] else 0)-ph)
        before_home,before_away=ratings[h],ratings[a]
        ratings[h]+=shift;ratings[a]-=shift
        ledger.append({**g,"home_before":round(before_home,6),
                       "away_before":round(before_away,6),"home_win_probability":round(ph,8),
                       "home_change":round(shift,6),"home_after":round(ratings[h],6),
                       "away_after":round(ratings[a],6)})
    if abs(sum(ratings.values())-sum(start.values()))>1e-6:
        raise AssertionError("Elo conservation failure")
    counts=Counter(x for g in games for x in (g["home"],g["away"]))
    ranked=sorted(ids,key=lambda i:(-ratings[i],i))
    return {"model":MODEL,"season":season,"status":"provisional" if not games or not prior else "computed",
            "built_at":datetime.now(timezone.utc).isoformat(),
            "params":params,"team_count":len(ids),"games_played":len(games),
            "source_policy":"official-first; never import third-party ratings",
            "start":{i:round(start[i],4) for i in ids},
            "ratings":{i:round(ratings[i],4) for i in ids},
            "rankings":[{"rank":n,"team_id":i,"team":teams[i]["name"],
                         "conference":teams[i].get("conference"),
                         "elo":round(ratings[i],4),"start_elo":round(start[i],4),
                         "change":round(ratings[i]-start[i],4),
                         "games":counts[i]} for n,i in enumerate(ranked,1)],
            "ledger":ledger}

def project(result,home,away,neutral=False):
    ratings=result["ratings"]
    if home not in ratings or away not in ratings or home==away:
        raise ValueError("Both teams must exist and differ")
    p=probability(ratings[home],ratings[away],neutral,result["params"])
    delta=ratings[home]-ratings[away]+(0 if neutral else result["params"]["home_advantage"])
    return {"home_win_probability":round(p,5),
            "away_win_probability":round(1-p,5),
            "projected_home_margin":round(delta/result["params"]["points_per_elo"],2),
            "status":"uncalibrated_estimate"}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--teams",required=True,type=Path)
    parser.add_argument("--games",required=True,type=Path)
    parser.add_argument("--season",required=True)
    parser.add_argument("--previous",type=Path)
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args()
    teams=validate_teams(json.loads(args.teams.read_text(encoding="utf-8")))
    games=load_games(args.games,teams)
    previous=json.loads(args.previous.read_text(encoding="utf-8")) if args.previous else None
    result=compute(teams,games,args.season,previous)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"{MODEL}: {len(teams)} registered D1 teams, {len(games)} verified finals; {args.output}")

if __name__=="__main__":main()

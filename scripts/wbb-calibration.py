#!/usr/bin/env python3
"""Historical women's basketball home-court and K-factor study.
Five independent 1500-start seasons. Select on 2022-25, evaluate untouched 2026.
The chronological K is a BENCHMARK, not falsely labeled as the RETRO gradient step.
"""
import collections
import json
import math
import pathlib

ROOT=pathlib.Path("data")
YEARS=(2022,2023,2024,2025,2026)
EDGES=(0,25,50,75,100,125)
KS=(12,18,24,30,40,50,60,80)
BASELINE=1500

def read(year):
    p=ROOT/f"wbb-{year-1}-{year}-results.json"
    content=json.loads(p.read_text(encoding="utf-8"))
    if not content.get("audit",{}).get("complete") or len(content.get("games",[]))<2500:
        raise RuntimeError(f"Missing complete women's historical season {year}")
    return sorted(content["games"],key=lambda g:(g["date"],str(g["id"])))

def score(games,edge,k):
    ratings=collections.defaultdict(lambda:BASELINE)
    brier=loss=0.0
    evaluated=0
    # All same-date games are forecast with the ratings available at day's start.
    for date,day in __import__("itertools").groupby(games,key=lambda x:x["date"][:10]):
        changes=collections.defaultdict(float)
        for g in day:
            a,b=str(g["home_id"]),str(g["away_id"])
            if a==b:continue
            hs,aws=int(g["home_score"]),int(g["away_score"])
            if hs==aws:continue
            home=0 if g.get("neutral") else edge
            p=1/(1+10**((ratings[b]-ratings[a]-home)/400))
            outcome=1.0 if hs>aws else 0.0
            safe=min(.999999,max(.000001,p))
            brier+=(p-outcome)**2
            loss-=outcome*math.log(safe)+(1-outcome)*math.log(1-safe)
            evaluated+=1
            # Chronological benchmark uses the same bounded MOV scale as RETRO.
            mov=min(2.5,1+math.log1p(abs(hs-aws))/3)
            delta=k*mov*(outcome-p)
            changes[a]+=delta
            changes[b]-=delta
        for team,delta in changes.items():
            ratings[team]=max(1000,min(2000,ratings[team]+delta))
    if not evaluated:raise RuntimeError("Historical season lacks valid results")
    return {"games":evaluated,"brier":brier/evaluated,"log_loss":loss/evaluated}

def combine(rows):
    total=sum(x["games"] for x in rows)
    return {"games":total,
            "brier":sum(x["brier"]*x["games"] for x in rows)/total,
            "log_loss":sum(x["log_loss"]*x["games"] for x in rows)/total}

def main():
    season={year:read(year) for year in YEARS}
    candidate=[]
    for edge in EDGES:
        for k in KS:
            train=combine([score(season[y],edge,k) for y in YEARS[:-1]])
            candidate.append({"home_edge":edge,"chronological_k":k,"train":train})
    candidate.sort(key=lambda x:(x["train"]["log_loss"],x["train"]["brier"]))
    best=candidate[0]
    holdout=score(season[2026],best["home_edge"],best["chronological_k"])
    baseline=score(season[2026],0,24)
    parameters={"home_edge":best["home_edge"],
                "benchmark_chronological_k":best["chronological_k"],
                "retro_optimizer_gradient_step":18}
    out={"status":"historical-calibration-complete",
        "sport":"NCAA Division I women's basketball",
        "source":"five independently verified women's D-I game seasons",
        "season_starts_at":BASELINE,
        "training_seasons":["2021-22","2022-23","2023-24","2024-25"],
        "untouched_holdout_season":"2025-26",
        "parameters":parameters,
        "train":best["train"],"holdout":holdout,"baseline_holdout":baseline,
        "search_grid":{"home_edges":list(EDGES),"chronological_k":list(KS)},
        "top_three_train":candidate[:3],
        "methodology":"Pre-game chronological Elo/log-loss K-and-home benchmark. Each season independently starts 1500; day-batched updates avoid same-day leakage. Historical team IDs are restricted to current D-I roster; coverage limitations are recorded in each import.",
        "retro_qualification":"Home edge is transferred to the independent all-games RETRO publisher as a historically tested starting estimate. The chronological K is NOT the RETRO gradient step and is NOT claimed to have optimized RETRO. Further RETRO-specific rolling-date validation is required before treating it as final."}
    target=ROOT/"ncaaw-retro-parameters.json"
    body=json.dumps(out,indent=2)+"\n"
    if not target.exists() or target.read_text()!=body:
        target.write_text(body)
    print("WBB historical study:",len(candidate),"parameter combinations")
    print("Selected home edge",best["home_edge"],"chronological K",best["chronological_k"])
    print("2025-26 untouched holdout",holdout)
    print("2025-26 no-home benchmark",baseline)

if __name__=="__main__":
    main()

#!/usr/bin/env python3
"""Leakage-free early-season diagnostic. Does not change production ratings."""
import json,math
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(p):return json.loads((ROOT/p).read_text(encoding="utf-8"))
data=load("data/ncaam-2026-27-retro-primary.json")
events=sorted(data["events"],key=lambda x:(x["date"],x["id"]))
teams=[t["team_id"] for t in data["rankings"]]
base=1500.
def prob(delta):return 1/(1+10**(-delta/400))
def fit(history,passes=160):
    ratings={t:base for t in teams}
    counts=defaultdict(int)
    for g in history:
        counts[g["home_id"]]+=1;counts[g["away_id"]]+=1
    # Recreate published all-games update from mbb-retro.js, past games only.
    for _ in range(passes):
        grad=defaultdict(float)
        for g in history:
            a,b=g["home_id"],g["away_id"]
            margin=abs(g["home_score"]-g["away_score"])
            scale=min(2.5,1+math.log1p(margin)/3)
            edge=0 if g.get("neutral") is True or g.get("site_verified") is not True else 100
            residual=scale*((1 if g["home_score"]>g["away_score"] else 0)-prob(ratings[a]-ratings[b]+edge))
            grad[a]+=residual;grad[b]-=residual
        for t in teams:
            if not counts[t]:continue
            old=ratings[t]
            ratings[t]=min(1900,max(1100,old+18*(grad[t]-.006*(old-base))/(3+counts[t])))
    return ratings
days=sorted({g["date"] for g in events})
tested=[]
for day in days:
    earlier=[g for g in events if g["date"]<day]
    today=[g for g in events if g["date"]==day]
    if not earlier:continue
    rating=fit(earlier)
    for g in today:
        verified=g.get("site_verified") is True
        venue=0 if g.get("neutral") is True or not verified else 100
        gap=rating[g["home_id"]]-rating[g["away_id"]]+venue
        tested.append({"date":day,"gap":gap,"result":int(g["home_score"]>g["away_score"]),"actual_margin":g["home_score"]-g["away_score"],"actual_abs_margin":abs(g["home_score"]-g["away_score"]),"venue_verified":verified})
slope=load("data/ncaam-score-calibration.json")["parameters"]["elo_margin_slope"]
def summarize(rows,mult):
    if not rows:return {"games":0}
    errs=[abs(g["actual_margin"]-g["gap"]*slope*mult) for g in rows]
    return {"games":len(rows),"mae":round(sum(errs)/len(errs),4),"brier":round(sum((prob(g["gap"]*mult)-g["result"])**2 for g in rows)/len(rows),5)}
labels=[(0,10,"0-9"),(10,20,"10-19"),(20,30,"20-29"),(30,40,"30-39"),(40,float("inf"),"40+")]
candidates={}
for mult in [1,1.25,1.5,2]:
    candidates[str(mult)]={
        "overall":summarize(tested,mult),
        "by_actual_absolute_margin":[{"bucket":name,**summarize([r for r in tested if low<=r["actual_abs_margin"]<high],mult)} for low,high,name in labels],
        "by_pregame_elo_gap":[{"bucket":name,**summarize([r for r in tested if low<=abs(r["gap"])<high],mult)} for low,high,name in [(0,100,"0-99"),(100,200,"100-199"),(200,300,"200-299"),(300,float("inf"),"300+")]]
    }
out={
 "status":"EARLY_SEASON_DIAGNOSTIC_NOT_PRODUCTION_VALIDATION",
 "method":"Each game uses RETRO refitted exclusively on games from earlier calendar dates; no same-day leakage. Production all-games 160-pass retrospective ratings approximated for earlier-date subsets.",
 "season":data["season"],"snapshot_as_of":data["as_of"],"available_dates":days,"tested_games":len(tested),
 "venue_policy":"100 Elo only for site_verified true and non-neutral; otherwise zero",
 "warnings":["Very small chronological sample; zero-game preseason days excluded.","The 1500 reset means no strength difference before the first verified finals.","Rating-sensitivity experiments do not justify changing production ratings without multi-season holdout tests.","Buckets are based on actual results or pregame Elo gaps; they are diagnostics, not model calibration."],
 "rating_sensitivity_multiplier_comparison":candidates
}
path=ROOT/"data/ncaam-forecast-early-season-validation.json"
path.write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"tested":len(tested),"baseline":candidates["1"]["overall"],"multipliers":{k:v["overall"] for k,v in candidates.items()}},indent=2))

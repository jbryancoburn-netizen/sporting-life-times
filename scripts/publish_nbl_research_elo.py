#!/usr/bin/env python3
"""Publish independently calculated, descriptive NBL Elo research ratings.

A research leaderboard does not claim validated predictive skill. The underlying
historical strength prior is fully disclosed and the forecasting release remains
withheld. A malformed or missing result aborts publication.
"""
import argparse,json,math
from pathlib import Path
from datetime import datetime, timezone

def retro_ratings(games,teams,home_advantage=65.0):
    """CFB-style retrospective same-season network ratings, neutral prior 1500.
    Each published snapshot refits only completed games (never future games).
    """
    ratings={team:1500.0 for team in teams}
    counts={team:0 for team in teams}
    for g in games:
        counts[g["home"]]+=1
        counts[g["away"]]+=1
    for _ in range(160):
        grad={team:0.0 for team in teams}
        for g in games:
            home,away=g["home"],g["away"]
            p=1/(1+10**((ratings[away]-ratings[home]-home_advantage)/400))
            residual=int(g["home_score"]>g["away_score"])-p
            grad[home]+=residual
            grad[away]-=residual
        max_change=0.0
        for team in teams:
            previous=ratings[team]
            ratings[team]=max(1100.0,min(1900.0,previous+18*(grad[team]-.006*(previous-1500))/(3+counts[team])))
            max_change=max(max_change,abs(ratings[team]-previous))
        if max_change<.0001:break
    return ratings

def calculate(baseline,ledger):
    if baseline.get("status")!="RESEARCH_ONLY_UNCERTIFIED" or baseline.get("training_games")!=337:
        raise ValueError("Historical NBL research baseline missing or altered")
    old=baseline.get("ratings_end_2025_26",{})
    if len(old)!=10 or any(not isinstance(x,(int,float)) or not math.isfinite(x) for x in old.values()):
        raise ValueError("Invalid ten-club historical Elo baseline")
    if ledger.get("season")!="2026-27" or ledger.get("source_status")!="uncertified_source_candidates":
        raise ValueError("Incomplete NBL current season research ledger")
    games=ledger.get("games")
    if not isinstance(games,list) or not games:
        raise ValueError("No NBL regular-season results to replay")
    k=float(baseline["parameters"]["k"])
    home_edge=float(baseline["parameters"]["home_advantage_elo"])
    ratings={team:1500.0 for team in old}
    start_total=sum(ratings.values())
    seen=set();previous="";updates=[];records={t:{"wins":0,"losses":0} for t in old}
    for g in games:
        ident=str(g.get("id",""))
        when=str(g.get("played_at",""))
        h,a=g.get("home"),g.get("away")
        if not ident or ident in seen:raise ValueError("Duplicate or missing NBL game ID")
        if not when or when[:10]<"2026-09-19" or when<previous:
            raise ValueError("Unsorted or preseason NBL result")
        if h not in ratings or a not in ratings or h==a:
            raise ValueError("Unknown or duplicate club")
        if g.get("verified") is not False or g.get("state")!="candidate":
            raise ValueError("Unexpected result certification")
        if not str(g.get("source_url","")).startswith("https://www.espn.com/"):
            raise ValueError("NBL research final has no ESPN provenance")
        hs,aws=g.get("home_score"),g.get("away_score")
        if type(hs)!=int or type(aws)!=int or min(hs,aws)<0 or hs==aws:
            raise ValueError("Invalid NBL final result")
        seen.add(ident);previous=when
        p=1/(1+10**((ratings[a]-ratings[h]-home_edge)/400))
        delta=k*(int(hs>aws)-p)
        ratings[h]+=delta;ratings[a]-=delta
        winner,loser=(h,a) if hs>aws else (a,h)
        records[winner]["wins"]+=1;records[loser]["losses"]+=1
        updates.append({"id":ident,"played_at":when,"home":h,"away":a,"home_score":hs,
                       "away_score":aws,"elo_delta_home":round(delta,3),"source_url":g["source_url"]})
    if abs(sum(ratings.values())-start_total)>1e-6:
        raise ValueError("Elo rating conservation failure")
    chronological=ratings.copy()\n    ratings=retro_ratings(games,old,home_edge)\n    ordered=sorted(ratings,key=lambda t:(-ratings[t],t))
    return {"status":"RESEARCH_ONLY_UNCERTIFIED","production_approved":False,
         "model":"nbl-retro-season-network-v1","season":"2026-27",
         "calculated_at":datetime.now(timezone.utc).isoformat(),
         "historical_training_games":337,"current_regular_season_games":len(updates),
         "parameters":{**baseline["parameters"],"offseason_regression":1.0},"rating_method":"RETRO completed-game network refit","retro_iterations_max":160,"chronological_comparator":{t:round(v,2) for t,v in chronological.items()},"season_start_elo":1500,"reset_every_season":True,"historical_sources":baseline["sources"],
         "ratings":[{"rank":i,"team":t,"elo":round(ratings[t],2),
                     "wins":records[t]["wins"],"losses":records[t]["losses"]}
                    for i,t in enumerate(ordered,1)],
         "recent_results":updates[-10:],
         "prediction_certified":False,
         "reason":"Research-only ratings; 2026-27 held-out probabilities failed 50/50 and prior-season home-rate benchmarks."}

def main():
    a=argparse.ArgumentParser()
    a.add_argument("--baseline",default="data/nbl-research-baseline.json")
    a.add_argument("--ledger",default="data/nbl-research-current-ledger.json")
    a.add_argument("--output",default="data/nbl-elo-research.json")
    args=a.parse_args()
    result=calculate(json.loads(Path(args.baseline).read_text()),
                     json.loads(Path(args.ledger).read_text()))
    target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2)+"\n")
    print("NBL research Elo published",result["current_regular_season_games"],"finals, ten clubs, predictions not certified")

if __name__=="__main__":main()

#!/usr/bin/env python3
"""Fit independent men's/women's 2026-27 DII Elo parameters on 2025-26 NCAA finals.

Walk forward every verified historical game from a fresh 1500 start, select K
and home edge on a chronological validation segment, then report a separate
untouched chronological test segment. ESPN is excluded from model training:
NCAA official/mirror score records must agree when both exist. No team rating,
player stat, or final from the previous season carries into 2026-27.
"""
from __future__ import annotations
import datetime as dt
import json
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from build_d2_basketball import (DATA,fetch_day,build_dii_team_lookup,
    resolve_dii_team_id,game_sort_key)

START=dt.date(2025,10,15)
END=dt.date(2026,4,12)
K_VALUES=(10,14,18,22,26,30,34,38)
EDGE_VALUES=(0,20,40,60,80,100,120)
def collect(gender, team_index):
    identity=build_dii_team_lookup(team_index)
    dates=[START+dt.timedelta(days=i) for i in range((END-START).days+1)]
    found={};conflicted=set();readable=0;unmatched=0;failures=[]
    # Network-bound public NCAA archives; bounded parallelism to avoid hammering.
    with ThreadPoolExecutor(max_workers=7) as pool:
        jobs={pool.submit(fetch_day,gender,day):day for day in dates}
        for job in as_completed(jobs):
            try:records,source=job.result();readable+=1
            except Exception as e:
                failures.append(str(e)[:140]);continue
            for game,away,home in records:
                if not str(game.get("source_provider","")).startswith("NCAA"):
                    continue
                if game.get("status")!="final":continue
                sa,sh=game.get("away_score"),game.get("home_score")
                if type(sa)!=int or type(sh)!=int or sa<=0 or sh<=0 or sa==sh:
                    continue
                ai=resolve_dii_team_id(away,identity)
                hi=resolve_dii_team_id(home,identity)
                if not ai or not hi or ai==hi:
                    unmatched+=1;continue
                if team_index[ai].get("not_eligible_for_dii_elo") or team_index[hi].get("not_eligible_for_dii_elo"):
                    continue
                key=(game["date"],tuple(sorted((ai,hi))))
                entry={"id":str(game["id"]),"date":game["date"],"away":ai,"home":hi,
                    "away_score":sa,"home_score":sh,"neutral":bool(game.get("neutral")),
                    "start_time":game.get("start_time","")}
                if key in found:
                    old=found[key]
                    old_score={old["away"]:old["away_score"],old["home"]:old["home_score"]}
                    new_score={ai:sa,hi:sh}
                    if old_score!=new_score or old["neutral"]!=entry["neutral"]:
                        conflicted.add(key)
                else:
                    found[key]=entry
    for key in conflicted:found.pop(key,None)
    ordered=sorted(found.values(),key=game_sort_key)
    diagnostics={"dated_requests":len(dates),"dates_retrieved":readable,
        "accepted_ncca_finals":len(ordered),"unmatched_identity_rows":unmatched,
        "source_disagreement_quarantined":len(conflicted),"failed_days":len(failures),
        "first_source_errors":failures[:5]}
    return ordered,diagnostics

def eval_model(games,teams,k,edge,start=0,stop=None):
    """Elo always starts at 1500 for EVERY school at season zero."""
    elo={team:1500.0 for team in teams}
    total=0.0;count=0;stop=len(games) if stop is None else stop
    for i,g in enumerate(games):
        a,h=g["away"],g["home"]
        home_adv=0 if g.get("neutral") else edge
        probability=1/(1+10**((elo[a]-elo[h]-home_adv)/400))
        if start<=i<stop:
            y=1 if g["home_score"]>g["away_score"] else 0
            total+=-(y*math.log(max(probability,1e-12))+
                     (1-y)*math.log(max(1-probability,1e-12)))
            count+=1
        y=1 if g["home_score"]>g["away_score"] else 0
        movement=k*(y-probability)
        elo[h]+=movement;elo[a]-=movement
    return total/count if count else None

def fit(games,teams):
    if len(games)<500 or len(set(x for g in games for x in (g["away"],g["home"])))<120:
        raise ValueError("Too few uniquely identified official historical finals for reliable DII fitting")
    # Chronological validation and final holdout; no games from 2026-27.
    a=int(len(games)*.60);b=int(len(games)*.80)
    choices=[(eval_model(games,teams,k,h,a,b),k,h)
             for k in K_VALUES for h in EDGE_VALUES]
    val,k,home=min(choices,key=lambda x:(x[0],x[1],x[2]))
    holdout=eval_model(games,teams,k,home,b,len(games))
    baseline=eval_model(games,teams,20,65,b,len(games))
    return {"status":"2025-26 NCAA DII historically fitted; independent 2026-27 reset",
        "k":k,"home_elo_edge":home,"sample_games":len(games),
        "train_games":a,"validation_games":b-a,"test_games":len(games)-b,
        "validation_log_loss":round(val,5),
        "unseen_test_log_loss":round(holdout,5),
        "provisional_20_65_test_log_loss":round(baseline,5),
        "source":"2025-26 NCAA original scoreboards and open NCAA scoreboard mirror",
        "no_previous_year_rating_carryover":True}
def main():
    report={"schema":1,"season":"2026-27","historical_source_season":"2025-26",
        "as_of":dt.datetime.now(dt.timezone.utc).isoformat(),
        "source_policy":"NCAA-only final scores; exact canonical DII opponent IDs; no ESPN-only results"}
    for gender in ("men","women"):
        current=json.loads((DATA/f"d2-{gender}-2026-27.json").read_text())
        teams={t["id"]:t for t in current["teams"]}
        games,diagnostics=collect(gender,teams)
        print(gender,"NCAA historical sources",diagnostics,flush=True)
        if diagnostics["dates_retrieved"]<140:
            raise RuntimeError(gender+" NCAA historical source availability below safe threshold")
        fitted=fit(games,teams)
        fitted["source_audit"]=diagnostics
        report[gender]=fitted
        print(gender,"2025-26 walk-forward model",fitted,flush=True)
    p=DATA/"d2-elo-parameters-2026-27.json"
    p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("historical DII calibration completed",p)
if __name__=="__main__":main()

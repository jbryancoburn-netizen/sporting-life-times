#!/usr/bin/env python3
"""Train-era-only NBL Elo parameter screen and untouched 2026-27 evaluation.
Research only: never promotes ratings or predictions.
"""
import argparse,itertools,json
from pathlib import Path
from nbl_three_season_eval import games,evaluate,START,lagged_home_baseline
GRID={"k":(5,10,15,20,30,40),"home":(0,20,40,65,90,120),"regression":(0,.15,.30,.50)}

def screen(seasons):
    trials=[]
    for k,home,r in itertools.product(GRID["k"],GRID["home"],GRID["regression"]):
        result=evaluate(seasons,k=k,home=home,regression=r)
        trials.append({"k":k,"home_advantage":home,"regression":r,
                       "validation_log_loss":result["2025-26"]["log_loss"]})
    winner=min(trials,key=lambda t:(t["validation_log_loss"],t["k"],t["home_advantage"],t["regression"]))
    scores=evaluate(seasons,k=winner["k"],home=winner["home_advantage"],regression=winner["regression"])
    old=evaluate(seasons,k=20,home=65,regression=.25)
    lagged=lagged_home_baseline(seasons)
    return {"status":"UNAPPROVED_RESEARCH_ONLY","production_approved":False,
        "selection_source":"2025-26 validation only; 2024-25 is warm-up",
        "heldout_not_used_for_selection":True,"grid":GRID,"trials":len(trials),
        "best_validation_parameters":winner,
        "selected_validation":scores["2025-26"],
        "selected_holdout":scores["2026-27"],
        "existing_holdout":old["2026-27"],
        "lagged_home_holdout":lagged["2026-27"],
        "selected_beats_lagged_holdout":scores["2026-27"]["log_loss"]<lagged["2026-27"]["log_loss"],
        "limitations":["Single validation season; search selection can overfit",
            "Candidate results require independent game-by-game verification",
            "Do not promote probabilities without stronger out-of-sample performance"]}

def main():
    p=argparse.ArgumentParser()
    for season in START:p.add_argument("--s"+season[:4],required=True)
    p.add_argument("--output",required=True);a=p.parse_args()
    seasons=[]
    for season in START:
        current,_=games(getattr(a,"s"+season[:4]),season)
        seasons.append((season,current))
    output=screen(seasons)
    path=Path(a.output);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps(output,indent=2))
if __name__=="__main__":main()

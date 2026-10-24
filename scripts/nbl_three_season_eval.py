#!/usr/bin/env python3
"""Three-season NBL temporal evaluation. Fixed parameters only; never certifies Elo.
2024-25 serves as historical warm-up, 2025-26 validation, 2026-27 untouched holdout.
"""
import argparse,json,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.backtest_nbl_elo import validate, TEAMS

START={"2024-25":"2024-09-19","2025-26":"2025-09-18","2026-27":"2026-09-19"}
def games(path,season):
    ledger=validate(json.loads(Path(path).read_text()))
    cutoff=START[season]
    regular=[g for g in ledger if g["played_at"][:10]>=cutoff and not (season=="2025-26" and g["id"]=="401858632")]
    if not regular:raise ValueError("No regular-season candidates for "+season)
    return regular, len(ledger)-len(regular)

def scoring(events):
    n=len(events)
    if not n:raise ValueError("Empty prediction window")
    return {"games":n,"log_loss":round(sum(-math.log(max(1e-12,p if y else 1-p)) for p,y in events)/n,6),
            "brier":round(sum((p-y)**2 for p,y in events)/n,6),
            "accuracy":round(sum((p>=.5)==y for p,y in events)/n,6)}

def evaluate(seasons,k=20.,home=65.,regression=.25):
    ratings={t:1500. for t in TEAMS}
    reports={}
    previous_end=None
    for name,ledger in seasons:
        if previous_end and not ledger[0]["played_at"]>previous_end:raise ValueError("Season overlap")
        previous_end=ledger[-1]["played_at"]
        if reports:
            ratings={t:1500+(r-1500)*(1-regression) for t,r in ratings.items()}
        obs=[]
        for g in ledger:
            h,a=g["home"],g["away"]
            p=1/(1+10**((ratings[a]-ratings[h]-home)/400))
            y=int(g["home_score"]>g["away_score"])
            obs.append((p,y))
            delta=k*(y-p)
            ratings[h]+=delta;ratings[a]-=delta
        reports[name]=scoring(obs)
    return reports

def lagged_home_baseline(seasons,smoothing=20):
    """Use only the PRECEDING season's home win rate, never held-out results."""
    prior=None
    output={}
    for name,games in seasons:
        p=.5 if prior is None else (prior[0]+smoothing*.5)/(prior[1]+smoothing)
        output[name]={"predicted_home_win_rate":round(p,6),
                      **scoring([(p,int(g["home_score"]>g["away_score"])) for g in games])}
        prior=(sum(g["home_score"]>g["away_score"] for g in games),len(games))
    return output

def main():
    parser=argparse.ArgumentParser()
    for season in START:parser.add_argument("--s"+season[:4],required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    inputs=[(season,getattr(args,"s"+season[:4])) for season in START]
    data={};excluded={}
    for season,path in inputs:data[season],excluded[season]=games(path,season)
    seasons=list(data.items())
    prediction=evaluate(seasons)
    lagged_baseline=lagged_home_baseline(seasons)
    baseline={"log_loss":round(math.log(2),6),"brier":.25}
    outcome={"status":"RESEARCH_UNCERTIFIED","publication_approved":False,
             "parameters":{"k":20,"home_advantage_elo":65,"regression":.25},
             "opening_prior":"equal 1500; assumption only",
             "nonleague_games_excluded":excluded,
             "known_standalone_cup_final_exclusion":{"2025-26":["401858632"]},
             "season_predictions":prediction,
             "coin_flip_baseline":baseline,
             "prior_season_home_rate_baseline":lagged_baseline,
             "holdout_beats_lagged_home_rate":prediction["2026-27"]["log_loss"]<lagged_baseline["2026-27"]["log_loss"],
             "validation_beats_coin_flip":prediction["2025-26"]["log_loss"]<baseline["log_loss"],
             "untouched_holdout_beats_coin_flip":prediction["2026-27"]["log_loss"]<baseline["log_loss"],
             "warnings":["2024-25 candidate scores have not received independent game-level confirmation",
               "One initial historical season is insufficient for robust parameter calibration",
               "Blitz and preseason results excluded at each regular-season boundary"]}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(outcome,indent=2)+"\n")
    print(json.dumps(outcome,indent=2))
if __name__=="__main__":main()

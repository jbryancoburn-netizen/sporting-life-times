#!/usr/bin/env python3
"""Honest out-of-season NBL Elo evaluation; candidate results, research only.
No parameter tuning on the held-out 2026-27 games and no Elo publication.
"""
import argparse, json, math, hashlib
from pathlib import Path
TEAMS=("Adelaide 36ers","Brisbane Bullets","Cairns Taipans","Illawarra Hawks",
"Melbourne United","New Zealand Breakers","Perth Wildcats","South East Melbourne Phoenix",
"Sydney Kings","Tasmania JackJumpers")

def replay(training,heldout,k=20.0,home=65.0,regression=.25):
    ratings={t:1500.0 for t in TEAMS}
    def update(g,score=True):
        h,a=g["home"],g["away"]
        p=1/(1+10**((ratings[a]-ratings[h]-home)/400))
        y=int(g["home_score"]>g["away_score"])
        if score:
            delta=k*(y-p);ratings[h]+=delta;ratings[a]-=delta
        return p,y
    for g in training:update(g)
    ratings={t:1500+(r-1500)*(1-regression) for t,r in ratings.items()}
    predictions=[]
    for g in heldout:
        p,y=update(g)
        predictions.append((p,y))
    if not predictions:raise ValueError("No holdout games")
    n=len(predictions)
    return {"n":n,"log_loss":round(sum(-math.log(max(1e-12,p if y else 1-p)) for p,y in predictions)/n,6),
            "brier":round(sum((p-y)**2 for p,y in predictions)/n,6),
            "accuracy":round(sum((p>=.5)==y for p,y in predictions)/n,6)}

def validate(payload):
    if payload.get("status")!="uncertified_source_candidates":raise ValueError("Not candidate data")
    games=payload.get("games")
    if not isinstance(games,list) or not games:raise ValueError("Empty candidate ledger")
    seen=set();prev=""
    for g in games:
        if g.get("verified") is not False or g.get("state")!="candidate":
            raise ValueError("Research candidate unexpectedly certified")
        if set((g.get("home"),g.get("away")))-set(TEAMS) or g.get("home")==g.get("away"):
            raise ValueError("Unknown or identical team")
        if g["id"] in seen:raise ValueError("Duplicate game")
        seen.add(g["id"])
        if g["played_at"]<prev:raise ValueError("Not chronological")
        prev=g["played_at"]
    return games

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--past",required=True);p.add_argument("--current",required=True);p.add_argument("--output",required=True)
    a=p.parse_args()
    past_bytes=Path(a.past).read_bytes();current_bytes=Path(a.current).read_bytes()
    train_raw=validate(json.loads(past_bytes));test_raw=validate(json.loads(current_bytes))
    # NBL26 began 2025-09-18; NBL27 regular season began 2026-09-19.
    # The NBL Blitz and other September 2026 exhibition games are excluded.
    train=[g for g in train_raw if g["played_at"][:10]>="2025-09-18"]
    test=[g for g in test_raw if g["played_at"][:10]>="2026-09-19"]
    if not train or not test:raise ValueError("No regular-season training or holdout finals")

    if {g["id"] for g in train}&{g["id"] for g in test}:raise ValueError("Overlapping seasons")
    if not train[-1]["played_at"]<test[0]["played_at"]:raise ValueError("Temporal leakage")
    observed=replay(train,test)
    neutral=replay(train,test,home=0)
    naive={"log_loss":round(-math.log(.5),6),"brier":.25}
    report={"status":"RESEARCH_UNCERTIFIED","approved_for_publication":False,
            "train_games":len(train),"holdout_games":len(test),
            "excluded_preseason_train":len(train_raw)-len(train),
            "excluded_preseason_holdout":len(test_raw)-len(test),
            "regular_season_start_dates":{"2025-26":"2025-09-18","2026-27":"2026-09-19"},
            "regular_season_start_sources":["https://www.nbl.com.au/news/nbl26-schedule-the-burning-questions","https://league.nbl.com.au/news/how-to-watch-saturday-nights-nbl27-season-openers"],
            "train_end":train[-1]["played_at"],"holdout_start":test[0]["played_at"],
            "source_sha256":{"past":hashlib.sha256(past_bytes).hexdigest(),"current":hashlib.sha256(current_bytes).hexdigest()},
            "existing_model":{"k":20,"home_advantage_elo":65,"offseason_regression":.25,"holdout":observed},
            "same_elo_without_home_advantage":{"holdout":neutral},
            "coin_flip_baseline":naive,
            "improves_over_coin_flip_log_loss":observed["log_loss"]<naive["log_loss"],
            "limitations":["Candidate source results have not received independent game-by-game verification",
               "Initial historical prior 1500 for every team is a modeling assumption, not an empirically certified baseline",
               "No lineup effects or score-margin calibration",
               "Model parameters must be chosen using training years, not this holdout"]}
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    Path(a.output).write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
if __name__=="__main__":main()

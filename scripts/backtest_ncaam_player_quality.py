#!/usr/bin/env python3
"""Chronological offseason player-scoring holdout. Input: audited per-game JSONL.
Each row must include season_end_year (2024/25/26), game_date, preseason_cutoff,
source_snapshot_at, prior_stats_latest_date, home_win (0/1), both teams' baseline
Elo, minutes-model offseason Elo adjustments, and independently constructed
preseason points/minute features (quality_home, quality_away).
Use 2024/25 as training and 2026 as untouched holdout.
No 2026 tuning; no post-cutoff inputs accepted.
"""
import argparse, json, math
from datetime import date
from pathlib import Path

def sigmoid(x):
    return 1/(1+math.exp(-max(-35,min(35,x))))
def score(rows, beta):
    losses=[]; briers=[]
    for r in rows:
        d=(r["home_base_elo"]+r["home_minutes_adjustment"]-
           r["away_base_elo"]-r["away_minutes_adjustment"]+
           beta*(r["quality_home"]-r["quality_away"]))
        p=sigmoid(d*math.log(10)/400)
        y=r["home_win"]
        losses.append(-(y*math.log(max(p,1e-15))+(1-y)*math.log(max(1-p,1e-15))))
        briers.append((p-y)**2)
    return {"games":len(rows),"log_loss":sum(losses)/len(rows),
            "brier":sum(briers)/len(rows)}
def load(path):
    rows=[json.loads(s) for s in Path(path).read_text().splitlines() if s.strip()]
    if not rows: raise ValueError("Empty historical dataset")
    unique=set()
    required=("season_end_year","game_id","game_date","preseason_cutoff",
              "source_snapshot_at","prior_stats_latest_date","home_win",
              "home_base_elo","away_base_elo","home_minutes_adjustment",
              "away_minutes_adjustment","quality_home","quality_away")
    for r in rows:
        if any(k not in r for k in required): raise ValueError("Missing required columns")
        if r["season_end_year"] not in (2024,2025,2026): raise ValueError("Unexpected season")
        identity=(r["season_end_year"],r["game_id"])
        if identity in unique: raise ValueError("Duplicate game ID")
        unique.add(identity)
        cutoff=date.fromisoformat(r["preseason_cutoff"])
        if (date.fromisoformat(r["source_snapshot_at"])>cutoff or
            date.fromisoformat(r["prior_stats_latest_date"])>cutoff):
            raise ValueError("POST-CUTOFF DATA LEAKAGE: "+str(identity))
        if not date.fromisoformat(r["game_date"])>cutoff:
            raise ValueError("Game not after preseason cutoff")
        if r["home_win"] not in (0,1): raise ValueError("Outcome not binary")
        for k in required[7:]:
            if not isinstance(r[k],(int,float)) or not math.isfinite(r[k]):
                raise ValueError("Non-finite feature "+k)
    return rows
def run(rows):
    train=[r for r in rows if r["season_end_year"] in (2024,2025)]
    hold=[r for r in rows if r["season_end_year"]==2026]
    if not train or not hold: raise ValueError("Missing training or untouched 2026 holdout")
    # Fixed candidate grid; tie-break by smaller absolute coefficient.
    candidates=[-160,-120,-80,-40,-20,0,20,40,80,120,160]
    beta=min(candidates,key=lambda b:(score(train,b)["log_loss"],abs(b)))
    baseline=score(hold,0); candidate=score(hold,beta)
    return {"train_seasons":[2024,2025],"holdout_season":2026,
            "training_games":len(train),"selected_quality_beta":beta,
            "baseline_minutes_model":baseline,"candidate_quality_model":candidate,
            "log_loss_gain":baseline["log_loss"]-candidate["log_loss"],
            "brier_gain":baseline["brier"]-candidate["brier"],
            "passes_both_metrics":candidate["log_loss"]<baseline["log_loss"] and
                candidate["brier"]<baseline["brier"] and beta!=0,
            "note":"Quality values are assumed to be reconstructed from genuine preseason-asof records; verify source provenance separately."}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("historical_jsonl")
    ap.add_argument("--output")
    a=ap.parse_args()
    result=run(load(a.historical_jsonl))
    rendered=json.dumps(result,indent=2)
    if a.output: Path(a.output).write_text(rendered+chr(10))
    print(rendered)
if __name__=="__main__": main()

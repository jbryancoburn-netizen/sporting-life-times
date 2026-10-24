#!/usr/bin/env python3
"""Rebuild formula-matched historical college-basketball player scoring experiment."""
import csv
import gzip
import json
import tempfile
from pathlib import Path
from backtest_ncaam_roster_elo import fetch
from backtest_ncaam_quality_retrospective import evaluate

def save(rows, destination):
    if not rows:raise ValueError("Empty historical dataset: "+str(destination))
    keys=list(dict.fromkeys(k for row in rows for k in row))
    with gzip.open(destination,"wt",newline="",encoding="utf-8") as out:
        writer=csv.DictWriter(out,fieldnames=keys,extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

def main():
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp)
        for year in (2023,2024,2025,2026):
            for remote,local in (("ncaa_mbb_rosters","team_rosters"),
                                 ("ncaa_mbb_player_box","player_box"),
                                 ("ncaa_mbb_schedule","schedule")):
                rows=fetch(remote,year)
                save(rows,root/f"ncaa_mbb_{local}_{year}.csv.gz")
                print(year,remote,len(rows),flush=True)
        result=evaluate(root)
        dest=Path("data/ncaam-exact-scoring-formula-retrospective-backtest.json")
        dest.parent.mkdir(exist_ok=True)
        dest.write_text(json.dumps(result,indent=2)+"\n")
        print(json.dumps({"beta":result["features"]["selected_quality_beta"],
                          "training":result["training_minutes_plus_quality"],
                          "holdout":result["holdout_minutes_plus_quality"],
                          "improves":result["holdout_both_metrics_improved"],
                          "boundary":result["training_grid_boundary"]},indent=2))
if __name__=="__main__":main()

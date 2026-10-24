#!/usr/bin/env python3
"""Rebuild formula-matched historical college-basketball player scoring experiment."""
import csv
import gzip
import json
import tempfile
import traceback
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
    diag={"status":"RUNNING","stage":"initialize","download_counts":{}}
    path=Path("data/ncaam-exact-scoring-execution-diagnostic.json")
    path.parent.mkdir(exist_ok=True)
    try:
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for year in (2023,2024,2025,2026):
                for remote,local in (("ncaa_mbb_rosters","team_rosters"),("ncaa_mbb_player_box","player_box"),("ncaa_mbb_schedule","schedule")):
                    diag["stage"]=f"download:{remote}:{year}"
                    print(diag["stage"],flush=True)
                    rows=fetch(remote,year)
                    save(rows,root/f"ncaa_mbb_{local}_{year}.csv.gz")
                    diag["download_counts"][f"{remote}_{year}"]=len(rows)
            diag["stage"]="evaluate"
            result=evaluate(root)
            output=Path("data/ncaam-exact-scoring-formula-retrospective-backtest.json")
            output.write_text(json.dumps(result,indent=2)+"\n")
            diag.update(status="SUCCESS",stage="complete",holdout_games=result["holdout_minutes_plus_quality"]["games"],beta=result["features"]["selected_quality_beta"])
    except Exception as error:
        diag.update(status="FAILED",exception_type=type(error).__name__,exception_message=str(error)[:500],traceback=traceback.format_exc()[-5000:])
        print(json.dumps(diag,indent=2),flush=True)
        raise
    finally:
        path.write_text(json.dumps(diag,indent=2)+"\n")
if __name__=="__main__":main()

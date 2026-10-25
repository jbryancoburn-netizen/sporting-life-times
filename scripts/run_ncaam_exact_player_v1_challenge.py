#!/usr/bin/env python3
"""Acquire pinned NCAA season tables and run the exact beta=300 shadow formula."""
import json,hashlib,os,tempfile,traceback
from pathlib import Path
from run_ncaam_exact_formula_diagnostic import save
from backtest_ncaam_roster_elo import fetch
from backtest_ncaam_exact_player_v1 import run
OUT=Path("data/ncaam-exact-player-v1-retrospective-challenge.json")
DIAG=Path("data/ncaam-exact-player-v1-execution-diagnostic.json")
def main():
    diag={"status":"RUNNING","commit":os.environ.get("GITHUB_SHA"),"sources":{},
          "formula_source_sha256":hashlib.sha256(Path("scripts/backtest_ncaam_exact_player_v1.py").read_bytes()).hexdigest()}
    try:
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for year in (2023,2024,2025,2026):
                for remote,local in (("ncaa_mbb_rosters","team_rosters"),
                                     ("ncaa_mbb_player_box","player_box"),
                                     ("ncaa_mbb_schedule","schedule")):
                    print("FETCH",year,remote,flush=True)
                    records=fetch(remote,year)
                    target=root/f"ncaa_mbb_{local}_{year}.csv.gz"
                    save(records,target)
                    diag["sources"][f"{remote}_{year}"]={"rows":len(records),
                        "sha256":hashlib.sha256(target.read_bytes()).hexdigest()}
            report=run(root)
            assert report["formula_beta"]==300 and report["production_approval"] is False
            assert report["historical_results"]["2026"]["baseline"]["games"]==report["historical_results"]["2026"]["exact_beta_300"]["games"]
            OUT.write_text(json.dumps(report,indent=2)+"\n")
            diag["holdout_games"]=report["historical_results"]["2026"]["baseline"]["games"]
            diag["holdout_log_loss_gain"]=report["historical_results"]["2026"]["log_loss_gain"]
            diag["holdout_brier_gain"]=report["historical_results"]["2026"]["brier_gain"]
            diag["status"]="SUCCESS"
    except Exception as exc:
        diag.update(status="FAILED",error=str(exc),traceback=traceback.format_exc()[-5000:])
        raise
    finally:
        DIAG.write_text(json.dumps(diag,indent=2)+"\n")
        print(json.dumps(diag,indent=2),flush=True)
if __name__=="__main__":main()

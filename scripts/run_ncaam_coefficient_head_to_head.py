#!/usr/bin/env python3
"""Fetch historical NCAA data once, evaluate both candidate formulas on identical games."""
import json,tempfile,traceback
from pathlib import Path
from backtest_ncaam_roster_elo import fetch
from run_ncaam_exact_formula_diagnostic import save
from backtest_ncaam_coefficient_head_to_head import run
OUT=Path("data/ncaam-coefficient-head-to-head.json")
DIAG=Path("data/ncaam-coefficient-head-to-head-diagnostic.json")
def main():
    diagnostic={"status":"running","download_rows":{}}
    try:
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for year in (2023,2024,2025,2026):
                for remote,kind in (("ncaa_mbb_rosters","team_rosters"),("ncaa_mbb_player_box","player_box"),("ncaa_mbb_schedule","schedule")):
                    rows=fetch(remote,year)
                    save(rows,root/f"ncaa_mbb_{kind}_{year}.csv.gz")
                    diagnostic["download_rows"][f"{remote}_{year}"]=len(rows)
            result=run(root)
            h=result["seasons"]["2026"]
            assert h["baseline"]["games"]==h["exact_beta300"]["games"]==h["quality_beta1200"]["games"]
            assert result["production_promotion_approved"] is False
            OUT.write_text(json.dumps(result,indent=2)+"\n")
            diagnostic.update(status="success",holdout_games=h["baseline"]["games"],
                holdout_baseline_log_loss=h["baseline"]["log_loss"],
                holdout_beta300_log_loss=h["exact_beta300"]["log_loss"],
                holdout_beta1200_log_loss=h["quality_beta1200"]["log_loss"])
    except Exception as exc:
        diagnostic.update(status="failed",error=str(exc),traceback=traceback.format_exc()[-4500:])
        raise
    finally:
        DIAG.write_text(json.dumps(diagnostic,indent=2)+"\n")
if __name__=="__main__":main()

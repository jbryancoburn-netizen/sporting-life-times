#!/usr/bin/env python3
"""Block NCAA opponent-quality promotion unless full holdout and provenance pass."""
import argparse,json,math
from pathlib import Path
def decision(report):
    required=("training_winner","holdout_baseline","holdout_adjusted",
              "holdout_all_games_game_only","holdout_all_games_enhanced_with_fallback",
              "holdout_fallback_window_sensitivity")
    missing=[k for k in required if k not in report]
    if missing:return {"approved":False,"reason":"MISSING_BACKTEST_FIELDS","missing":missing}
    base=report["holdout_all_games_game_only"]
    candidate=report["holdout_all_games_enhanced_with_fallback"]
    same_contests=(bool(base.get("matched_games_sha256")) and
                   base.get("matched_games_sha256")==candidate.get("matched_games_sha256"))
    complete=(same_contests and base.get("games")==candidate.get("games")
              and isinstance(base.get("games"),int) and base["games"]>=1000)
    improved=all(math.isfinite(base.get(k,float("nan"))) and
                 math.isfinite(candidate.get(k,float("nan"))) and
                 candidate[k]<base[k] for k in ("log_loss","brier"))
    valid=(complete and improved and report.get("preseason_information_integrity_verified") is True
           and report.get("training_grid_edge_solution") is False
           and report.get("fallback_all_windows_improve_both_metrics") is True)
    return {"approved":bool(valid),"complete_game_coverage":bool(complete),
            "identical_contest_id_sample":bool(same_contests),
            "both_scores_improve":bool(improved),
            "preseason_roster_provenance_verified":
                report.get("preseason_information_integrity_verified") is True,
            "reason":"CERTIFIED" if valid else "RESEARCH_ONLY_VALIDATION_INCOMPLETE"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--report",type=Path,default=Path("data/ncaam-opponent-quality-backtest.json"))
    args=p.parse_args()
    if not args.report.exists():
        print(json.dumps({"approved":False,"reason":"BACKTEST_REPORT_NOT_PUBLISHED",
                          "path":str(args.report)}))
        return  # Expected research state; no false promotion
    verdict=decision(json.loads(args.report.read_text(encoding="utf-8")))
    print(json.dumps(verdict,indent=2))
    if verdict["approved"]:
        print("Opponent model qualifies for further release review; this script does not promote ratings.")
if __name__=="__main__":main()

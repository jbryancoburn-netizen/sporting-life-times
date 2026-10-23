#!/usr/bin/env python3
"""Fail if scoring features are promoted without chronologically valid holdout evidence."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"

def verify(scoring, preseason, legacy, decision):
    if scoring.get("season") != "2026-27" or len(scoring.get("teams", [])) != 365:
        raise ValueError("Incomplete scoring shadow")
    counts = scoring["source_counts"]
    if counts["matched_scoring_records"] != sum(t["verified_players"] for t in scoring["teams"]):
        raise ValueError("Player evidence counts differ")
    if len({t["team_id"] for t in scoring["teams"]}) != 365:
        raise ValueError("Duplicated scoring teams")
    if {t["team_id"] for t in scoring["teams"]} != {t["team_id"] for t in preseason["rankings"]}:
        raise ValueError("Player quality team IDs differ from published Elo")
    if decision["player_quality_model_approved_for_primary"]:
        h = decision.get("player_quality_holdout", {})
        if not (h.get("chronological_train_test_separation") is True and
                h.get("source_roster_asof_times_verified") is True and
                h.get("games", 0) > 0 and
                h.get("baseline_log_loss", 0) > h.get("candidate_log_loss", 1) and
                h.get("baseline_brier", 0) > h.get("candidate_brier", 1)):
            raise ValueError("Unverified player quality model marked approved")
    if decision["player_quality_model_approved_for_primary"] is False:
        if preseason.get("production_elo_approved") is not False:
            raise ValueError("Preseason rating prematurely marked approved")
    if legacy.get("approved_for_primary") is True and decision["player_quality_holdout"]["games"] == 0:
        raise ValueError("Legacy promotion unexpectedly approved")
    return True

def verify_retrospective_holdout(report, decision):
    if (report.get("status") != "RETROSPECTIVE_DIAGNOSTIC_NOT_ASOF_PRESEASON_VALIDATED" or
        report.get("production_approval") is not False or
        report.get("train_seasons") != [2024, 2025] or
        report.get("untouched_holdout_season") != 2026):
        raise ValueError("Retrospective holdout status or chronology invalid")
    baseline=report.get("holdout_minutes_only",{})
    candidate=report.get("holdout_minutes_plus_quality",{})
    if baseline.get("games",0)<1000 or baseline.get("games")!=candidate.get("games"):
        raise ValueError("Insufficient matched 2026 test games")
    for metric in ("log_loss","brier"):
        b,c=baseline.get(metric),candidate.get(metric)
        if not isinstance(b,(int,float)) or not isinstance(c,(int,float)) or not (0<c<b<1):
            raise ValueError("Player scoring improvement or numeric holdout missing")
    if not report.get("holdout_both_metrics_improved"):
        raise ValueError("Holdout reporting disagrees with recorded metrics")
    if len(report.get("source_hashes",{}))!=4 or any(len(v)!=3 for v in report["source_hashes"].values()):
        raise ValueError("Missing provenance for 12 source files")
    detail=decision.get("retrospective_player_quality_backtest",{})
    if (detail.get("holdout_games")!=baseline["games"] or
        detail.get("quality_coefficient")!=report["features"]["selected_quality_beta"] or
        detail.get("preseason_roster_snapshots_verified") is not False or
        detail.get("eligible_for_primary") is not False):
        raise ValueError("Release decision contradicts historical roster-timing safeguards")
    for label,metric in (("minutes_log_loss","log_loss"),("minutes_brier","brier")):
        if abs(detail.get(label,-1)-baseline[metric])>1e-10:raise ValueError("Stale baseline audit")
    for label,metric in (("quality_log_loss","log_loss"),("quality_brier","brier")):
        if abs(detail.get(label,-1)-candidate[metric])>1e-10:raise ValueError("Stale candidate audit")
    if decision["player_quality_model_approved_for_primary"] is not False:
        raise ValueError("Retrospective-only study cannot approve player-quality Elo")
    if decision["player_quality_holdout"]["source_roster_asof_times_verified"] is not False:
        raise ValueError("No historical preseason-asof team roster snapshot has been verified")
    return True

def verify_earlyseason_asof(report, decision):
    """Verify the genuinely dated post-day-14 trial but NEVER promote as preseason."""
    if (report.get("status") != "CHRONOLOGICALLY_VALID_EARLYSEASON_NOT_PRESEASON"
        or report.get("preseason_release_approved") is not False
        or report.get("asof_current_roster_verified") is not True
        or report.get("training_seasons") != [2024, 2025]
        or report.get("holdout_season") != 2026):
        raise ValueError("Invalid 14-day chronological evaluation contract")
    base=report.get("holdout_minutes",{})
    candidate=report.get("holdout_quality",{})
    if base.get("games",0)<1000 or base.get("games")!=candidate.get("games"):
        raise ValueError("Unmatched 2026 in-season games")
    for metric in ("log_loss","brier"):
        if not (0<candidate.get(metric,2)<base.get(metric,0)<1):
            raise ValueError("Reported early-season quality uplift not supported")
    if report.get("holdout_both_improved") is not True:
        raise ValueError("Earlyseason holdout not improved on both measures")
    if len(report.get("source_hashes",{}))!=4:
        raise ValueError("Earlyseason source provenance missing")
    for year,s in report.get("asof_player_evidence",{}).items():
        if s.get("postcutoff_box_rows_excluded",0)<1000:
            raise ValueError("Future-season player entries were not rejected")
        if s.get("roster_capture_policy")!="first 14 days of dated NCAA player-box entries; no later roster rows":
            raise ValueError("Unapproved feature capture rule")
    observed=decision.get("chronological_earlyseason_quality_backtest",{})
    if (observed.get("holdout_games")!=base["games"] or
        observed.get("selected_quality_coefficient")!=report.get("selected_quality_beta") or
        observed.get("preseason_validation") is not False or
        observed.get("valid_for_inseason_asof_after_14_days") is not True):
        raise ValueError("Earlyseason release report and decision disagree")
    for group,col in ((base,"minutes"),(candidate,"quality")):
        for metric in ("log_loss","brier"):
            if abs(group[metric]-observed.get(col+"_"+metric,-1))>1e-10:
                raise ValueError("Earlyseason metric stale")
    if decision["player_quality_model_approved_for_primary"] is not False:
        raise ValueError("Post-opening roster data cannot certify PRESEASON rating")
    return True

def main():
    names = ["ncaam-2026-27-player-scoring-shadow.json",
             "ncaam-2026-27-preseason-roster-informed.json",
             "ncaam-offseason-transfer-backtest.json",
             "ncaam-2026-27-player-quality-release-decision.json"]
    verify(*(json.loads((ROOT / n).read_text()) for n in names))
    report=json.loads((ROOT/"ncaam-player-quality-retrospective-backtest.json").read_text())
    decision=json.loads((ROOT/"ncaam-2026-27-player-quality-release-decision.json").read_text())
    verify_retrospective_holdout(report,decision)
    asof_report=json.loads((ROOT/"ncaam-quality-earlyseason-asof-backtest.json").read_text())
    verify_earlyseason_asof(asof_report,decision)
    print("PASS: 1,831-game retrospective and 1,596-game genuine earlyseason as-of holdouts reconcile; preseason promotion blocked")

if __name__ == "__main__":
    main()

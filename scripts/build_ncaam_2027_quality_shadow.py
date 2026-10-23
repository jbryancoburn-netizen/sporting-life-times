#!/usr/bin/env python3
"""2026–27 independent NCAA roster/scoring-quality experimental PRESEASON shadow.

The 400-Elo/quality coefficient was fit on 2024/25 as-of DAY-14 player
snapshots and beat incumbent on 2026 *post-day-14* holdout. Extrapolating
it to first tipoff has not been validated; this file is NOT primary Elo.
Unknown freshmen, D2 and international arrivals receive no invented points.
"""
import argparse
import gzip
import csv
import hashlib
import json
import math
import statistics
from pathlib import Path
from backtest_ncaam_quality_retrospective import collect_prior_stats

def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def quality_mean(box_path):
    with gzip.open(box_path,"rt",newline="",encoding="utf-8") as f:
        rows=list(csv.DictReader(f))
    if len(rows)<100000:
        raise ValueError("Incomplete previous-season NCAA player box source")
    _prior,_minutes,avg,excluded,ambiguous=collect_prior_stats(rows)
    if not (0.20<avg<0.65):
        raise ValueError("Unreasonable source NCAA points-per-minute mean")
    return avg, {"box_rows":len(rows),"name_ambiguous_excluded":ambiguous,
                 "source_errors":excluded}

def build(roster,scoring,minutes,study,decision,source_path):
    if roster.get("team_count")!=365 or roster.get("season")!="2026-27":
        raise ValueError("Incomplete roster-informed preseason rankings")
    if roster.get("production_elo_approved") is not False:
        raise ValueError("Refusing to supersede or promote the official provisional preseason")
    if scoring.get("source_counts",{}).get("matched_scoring_records")!=2923:
        raise ValueError("Verified prior scoring evidence changed")
    if (study.get("status")!="CHRONOLOGICALLY_VALID_EARLYSEASON_NOT_PRESEASON"
        or study.get("holdout_both_improved") is not True
        or study.get("preseason_release_approved") is not False
        or decision.get("player_quality_model_approved_for_primary") is not False
        or decision.get("chronological_earlyseason_quality_backtest",{}).get("preseason_validation") is not False):
        raise ValueError("Unapproved prior score-quality calibration or release status")
    beta=study["selected_quality_beta"]
    if not isinstance(beta,(int,float)) or not math.isfinite(beta) or beta!=400:
        raise ValueError("Unreviewed scoring-quality coefficient")
    source_path=Path(source_path)
    digest=hashlib.sha256(source_path.read_bytes()).hexdigest()
    if digest!=study["source_hashes"]["2026"]["player_box"]:
        raise ValueError("Prior player box evidence changed since chronological trial")
    avg,box_audit=quality_mean(source_path)
    denominators={r["team_id"]:float(r["prior_minutes"]) for r in minutes["teams"]}
    scores={r["team_id"]:r for r in scoring["teams"]}
    primary={r["team_id"]:r for r in roster["rankings"]}
    if len(primary)!=365 or len(scores)!=365 or len(denominators)!=365 or not(set(primary)==set(scores)==set(denominators)):
        raise ValueError("365-team identity mismatch across all source files")
    residual={}
    for tid,p in primary.items():
        s=scores[tid]
        denominator=denominators[tid]
        expected=p.get("evidence_player_count",0)
        if expected!=s["verified_players"]:
            raise ValueError("Scoring and minutes source disagree on matched player count for "+tid)
        if p["roster_coverage"]!="source-confirmed-prior-minutes" or denominator<1000:
            residual[tid]=None
            continue
        total_points=float(s["returning_prior_points"])+float(s["incoming_prior_points"])
        total_minutes=float(s["returning_prior_minutes"])+float(s["incoming_prior_minutes"])
        if total_points<0 or total_minutes<=0 or s["verified_players"]<1:
            raise ValueError("Unsupported verified historical scoring sample for "+tid)
        residual[tid]=(total_points-avg*total_minutes)/denominator
    population=[v for v in residual.values() if v is not None]
    if len(population)!=364 or len(residual)-len(population)!=1:
        raise ValueError("Incomplete 364+1 fallback quality feature coverage")
    center=statistics.median(population)
    result=[]
    for tid,p in primary.items():
        q=residual[tid]
        delta=round(beta*(q-center),4) if q is not None else 0.0
        base=float(p["elo"])
        result.append({"team_id":tid,"team":p["team"],"conference":p["conference"],
            "roster_informed_elo":round(base,4),
            "verified_prior_player_scoring_count":scores[tid]["verified_players"],
            "scoring_quality_residual_per_prior_school_minute":round(q,8) if q is not None else None,
            "experimental_scoring_quality_adjustment":delta,
            "elo":round(base+delta,4),
            "scoring_quality_evidence":"source-scored-verified-D1-only" if q is not None else "no-source-data-retain-baseline",
            "season_games":0})
    result.sort(key=lambda t:(-t["elo"],t["team_id"]))
    for i,t in enumerate(result,1):
        t["rank"]=i
    if max(abs(p["experimental_scoring_quality_adjustment"]) for p in result)>80:
        raise ValueError("One or more experimental scoring adjustments exceed safe review range")
    return {
        "model":"slat-ncaam-2026-27-experimental-scorer-v1",
        "season":"2026-27",
        "status":"SHADOW_ONLY_DO_NOT_PROMOTE",
        "production_elo_approved":False,
        "preseason_asof_certified":False,
        "season_games":0,"team_count":365,
        "input_primary":"data/ncaam-2026-27-preseason-roster-informed.json",
        "calibration":"data/ncaam-quality-earlyseason-asof-backtest.json",
        "limitations":[
            "Coefficient only validated for predictions AFTER an actual 14-day player-roster observation period",
            "Season 2026-27 has not played; preseason extrapolation remains unproven",
            "2026-27 roster sources not all school-official timestamp-preserved records",
            "Only 2,923 player histories linked; freshmen/D2/overseas arrivals and unlinked transfers have no imputed value",
            "Historical school-player identities with ambiguous/poor minutes records were excluded"],
        "source_integrity":{
            "historical_2025_26_player_box_sha256":digest,
            "historical_2025_26_player_box":str(source_path),
            "prior_league_points_per_minute":round(avg,10),
            "previous_school_minutes_normalization":"2025-26 program total minutes",
            "centered_quality_median":round(center,10),
            "quality_beta":beta,
            "matched_verified_history":2923,
            "adjusted_team_count":364,
            "fallback_team_count":1,
            **box_audit},
        "rankings":result}
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--data",type=Path,default=Path("data"))
    parser.add_argument("--historical-player-box",type=Path,required=True)
    parser.add_argument("--study",type=Path,help="Fresh actual early-season backtest result; overrides published study")
    parser.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-scoring-quality-shadow.json"))
    args=parser.parse_args()
    d=args.data
    doc=build(load_json(d/"ncaam-2026-27-preseason-roster-informed.json"),
              load_json(d/"ncaam-2026-27-player-scoring-shadow.json"),
              load_json(d/"ncaam-2026-27-minutes-retention-audit.json"),
              load_json(args.study or (d/"ncaam-quality-earlyseason-asof-backtest.json")),
              load_json(d/"ncaam-2026-27-player-quality-release-decision.json"),
              args.historical_player_box)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(doc,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"status":doc["status"],"teams":doc["team_count"],
       "top_10":[{"team":x["team"],"elo":x["elo"]} for x in doc["rankings"][:10]]},indent=2))
if __name__=="__main__":
    main()

#!/usr/bin/env python3
"""Independent team-level audit of 2026-27 experimental NCAA Elo.

The original calibration measures wins but does not test per-team ranking
plausibility. This is a strict publication gate, not a cosmetic Elo cap.
"""
import json,argparse
from pathlib import Path
def audit(data):
    rows=data["rankings"];issues=[];all_teams=[]
    for row in rows:
        reasons=[]
        adjustment=float(row["offseason_adjustment"])
        incoming=row.get("incoming_transfer_prior_minutes_share")
        returning=row.get("returning_minutes_share")
        if abs(adjustment)>75:reasons.append("extreme_absolute_adjustment_over_75")
        if incoming is not None and incoming>1:reasons.append("incoming_prior_minutes_exceed_previous_team_minutes")
        if incoming is not None and incoming>.8:reasons.append("incoming_minutes_high_needs_player_by_player_verification")
        if returning is not None and returning<.05 and adjustment>50:reasons.append("near_zero_returners_large_positive_boost")
        detail={"team_id":row["team_id"],"team":row["team"],"rank":row["rank"],\n            "base_elo":row["base_elo"],"adjustment":adjustment,\n            "incoming_ratio":incoming,"returning_ratio":returning,\n            "reasons":reasons,"status":"flagged" if reasons else "pending-player-level-verification"}\n        all_teams.append(detail)\n        if reasons:issues.append({"team_id":row["team_id"],"team":row["team"],
            "rank":row["rank"],"base_elo":row["base_elo"],
            "adjustment":adjustment,"incoming_ratio":incoming,
            "returning_ratio":returning,"reasons":reasons})
    issues.sort(key=lambda x:(-abs(x["adjustment"]),x["team"]))
    max_adj=max(abs(float(r["offseason_adjustment"])) for r in rows)
    return {"season":data["season"],"model":data["model"],
        "team_count":len(rows),"flagged_teams":len(issues),
        "maximum_absolute_adjustment":round(max_adj,4),
        "thresholds":{"absolute_adjustment":75,"incoming_ratio_warning":.8,
                      "incoming_ratio_hard":1},
        "identity_findings":[
          "Historical backtest matches normalized player names; same-name athletes across schools are ambiguous.",
          "Production uses cross-provider player IDs without an independently audited player-ID namespace crosswalk.",
          "Production incoming minutes count prior raw minutes, not opponent-adjusted performance.",
          "Transfer minutes are divided by old team's minutes, which can over-reward high-volume imports.",
          "Only a single held-out season was used; team-level coefficient stability is unverified."],
        "release_approved":False,"all_teams_audited_for_anomalies":len(all_teams),\n        "all_teams_player_level_verified":0,
        "release_blockers":["team-level outliers present" if issues else "player-identity and strength-of-schedule calibration not validated",
                            "cross-provider player IDs require collision and namespace audit",
                            "conference-strength and transfer-quality adjustment not backtested"],
        "flagged":issues,"all_teams":sorted(all_teams,key=lambda x:x["team"])}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--ratings",type=Path,default=Path("data/ncaam-2026-27-offseason-shadow.json"))
    p.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-ranking-audit.json"))
    a=p.parse_args()
    x=audit(json.loads(a.ratings.read_text()))
    a.out.write_text(json.dumps(x,indent=2)+"\n")
    print(json.dumps({k:x[k] for k in ("team_count","flagged_teams","maximum_absolute_adjustment","release_approved","release_blockers")},indent=2))
    for row in x["flagged"][:20]:
        print(row["team"],row["adjustment"],",".join(row["reasons"]))
if __name__=="__main__":main()

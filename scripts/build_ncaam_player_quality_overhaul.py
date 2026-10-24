#!/usr/bin/env python3
"""Auditable 2026-27 player-quality offseason Elo challenger.

An unapproved *shadow* model, not a silently promoted production forecast.
Current NCAA-ESPN identity-linked player points/minutes are observed; missing
players receive no invented rating. Incoming prior production is discounted
for uncertain context. All coefficients are explicit scenarios until strictly
preseason historical as-of validation is possible.
"""
import json
from pathlib import Path

def build(base, roster, scoring, shadow, transfer_weight=0.5, roster_weight=0.5, scoring_weight=1.0):
    assert 0 <= transfer_weight <= 1 and 0 <= roster_weight <= 1 and 0 <= scoring_weight <= 1
    assert base["season"] == roster["season"] == scoring["season"] == shadow["season"] == "2026-27"
    assert len(base["rankings"]) == len(roster["rankings"]) == len(scoring["teams"]) == len(shadow["rankings"]) == 365
    assert shadow["status"] == "SHADOW_ONLY_DO_NOT_PROMOTE"
    b={x["team_id"]:x for x in base["rankings"]}
    s={x["team_id"]:x for x in scoring["teams"]}
    q={x["team_id"]:x for x in shadow["rankings"]}
    assert len(b)==len(s)==len(q)==365
    assert {x["team_id"] for x in roster["rankings"]}==set(b)
    rows=[]
    identity_mismatches=[]
    baseline_fallbacks=[]
    for team in roster["rankings"]:
        tid=team["team_id"]
        identity_ok=s[tid]["verified_players"]==team["evidence_player_count"]
        if not identity_ok:
            if team["roster_coverage"]=="baseline-fallback" and team["evidence_player_count"]==0:
                baseline_fallbacks.append({"team_id":tid,"excluded_scoring_records":s[tid]["verified_players"],"reason":"No source-confirmed team-level historical minutes denominator"})
            else:
                identity_mismatches.append({"team_id":tid,"roster_count":team["evidence_player_count"],"scoring_count":s[tid]["verified_players"]})
        baseline=float(b[tid]["elo"])
        # Do not reward unverified incoming minutes as though all transfers
        # came from comparably strong competition.
        returning=float(team["returning_minutes_share"] or 0)
        incoming=float(team["incoming_transfer_prior_minutes_share"] or 0)
        median_r=float(roster["parameters"]["median_retention"])
        median_i=float(roster["parameters"]["median_incoming_minutes"])
        retention_component=120*(returning-median_r)
        transfer_component=160*(incoming-median_i)*transfer_weight
        # Quality term is calculated from verified historical scoring; it is
        # context-uncalibrated and retained strictly as a research scenario.
        quality=float(q[tid]["experimental_scoring_quality_adjustment"])*scoring_weight if identity_ok else 0.0
        adj=round(roster_weight*(retention_component+transfer_component)+quality,4)
        rows.append({"team_id":tid,"team":team["team"],"conference":team["conference"],
                     "base_elo":round(baseline,4),"retention_component":round(retention_component*roster_weight,4),
                     "transfer_component":round(transfer_component*roster_weight,4),
                     "quality_component":round(quality,4),"offseason_adjustment":adj,
                     "elo":round(baseline+adj,4),
                     "verified_player_count":s[tid]["verified_players"],"identity_count_reconciled":identity_ok,
                     "unverified_player_quality_imputed":False,"season_games":0})
    rows.sort(key=lambda x:(-x["elo"],x["team_id"]))
    for i,x in enumerate(rows,1):x["rank"]=i
    return {"model":"slat-ncaam-2026-27-player-quality-challenger-v3",
      "season":"2026-27","status":"SHADOW_UNCERTIFIED_PRESEASON",
      "production_elo_approved":False,"preseason_asof_certified":False,
      "team_count":365,"games_played":0,"identity_mismatches":identity_mismatches,
      "baseline_fallbacks":baseline_fallbacks,
      "inputs":{"game_baseline":"ncaam-2026-27-preseason-provisional.json",
                "roster":"ncaam-2026-27-preseason-roster-informed.json",
                "player_quality":"ncaam-2026-27-scoring-quality-shadow.json",
                "player_scoring":"ncaam-2026-27-player-scoring-shadow.json"},
      "scenario":{"transfer_weight":transfer_weight,"roster_weight":roster_weight,
                  "scoring_weight":scoring_weight},
      "limitations":["Scoring points per prior minute is not full player value or defensive quality",
                     "School-strength and previous competition adjustment not certified",
                     "Missing player and freshman value not imputed",
                     "Uncovered programs retain their own baseline with linked quality evidence excluded",
                     "Mismatched cross-source player counts receive zero quality adjustment",
                     "No season-opening as-of roster snapshot held-out validation",
                     "Do not substitute this exploratory rating for certified predictions"],
      "rankings":rows}

def main():
    d=Path("data")
    read=lambda n:json.loads((d/n).read_text())
    result=build(read("ncaam-2026-27-preseason-provisional.json"),
                 read("ncaam-2026-27-preseason-roster-informed.json"),
                 read("ncaam-2026-27-player-scoring-shadow.json"),
                 read("ncaam-2026-27-scoring-quality-shadow.json"))
    path=d/"ncaam-2026-27-player-quality-overhaul-shadow.json"
    path.write_text(json.dumps(result,indent=2)+"\n")
    print("Built independent player-quality offseason challenger:",len(result["rankings"]),"teams")
if __name__=="__main__":main()

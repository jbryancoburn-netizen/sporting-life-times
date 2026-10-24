#!/usr/bin/env python3
"""Score immutable NCAA soccer forecasts against verified post-kickoff finals.
Usage: python scripts/score_college_soccer_v2.py
Writes data/college-soccer-forecast-scores-v2.json.
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORECAST = ROOT / "data/college-soccer-prospective-v2.json"
FINALS = ROOT / "data/college-soccer-elo-final-ledger.json"
OUTPUT = ROOT / "data/college-soccer-forecast-scores-v2.json"
COHORTS = ("men-d1", "men-d2", "men-d3", "women-d1", "women-d2", "women-d3")

def instant(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)

def mean(seq):
    return round(sum(seq) / len(seq), 8) if seq else None

def score():
    archive = json.loads(FORECAST.read_text())
    ledger = json.loads(FINALS.read_text())
    if archive.get("model") != "ncaa_matchup_draw_v2" or archive.get("status") != "prospective_research_only":
        raise ValueError("Unexpected forecast archive")
    forecasts = archive["forecasts"]
    indexed = {}
    for f in forecasts:
        key = f["match_id"]
        if key in indexed:
            raise ValueError("Duplicate locked forecast: " + key)
        probs = [float(f["p_away"]), float(f["p_draw"]), float(f["p_home"])]
        if not all(math.isfinite(p) and 0 <= p <= 1 for p in probs) or abs(sum(probs) - 1) > 0.00001:
            raise ValueError("Invalid probabilities: " + key)
        if instant(f["forecasted_at_utc"]) >= instant(f["kickoff_utc"]):
            raise ValueError("Forecast not pregame: " + key)
        indexed[key] = f
    finals = {}
    quarantine = []
    conflicts = set()
    for game in ledger["results"]:
        key = game["match_id"]
        if key in finals and finals[key] != game:
            quarantine.append({"match_id": key, "reason": "conflicting_finals"})
            conflicts.add(key)
        finals.setdefault(key, game)
    scores = []
    for key, forecast in indexed.items():
        game = finals.get(key)
        if key in conflicts or not game:
            continue
        if game["home_team"] != forecast["home_team"] or game["away_team"] != forecast["away_team"]:
            quarantine.append({"match_id": key, "reason": "team_mismatch"})
            continue
        # A date alone does not prove that a final occurred after a forecast.
        # Finals published for earlier calendar days cannot score this archive.
        if game["date"] < instant(forecast["kickoff_utc"]).date().isoformat():
            quarantine.append({"match_id": key, "reason": "final_date_before_kickoff"})
            continue
        home, away = int(game["home_goals"]), int(game["away_goals"])
        if min(home, away) < 0:
            quarantine.append({"match_id": key, "reason": "invalid_score"})
            continue
        outcome = "home" if home > away else "away" if away > home else "draw"
        order = ("away", "draw", "home")
        probs = [float(forecast["p_" + name]) for name in order]
        truth = [int(name == outcome) for name in order]
        top = max(probs)
        winners = [order[i] for i, value in enumerate(probs) if abs(value - top) < 1e-12]
        pick = winners[0] if len(winners) == 1 else None
        scores.append({
            "match_id": key, "cohort": forecast["cohort"], "outcome": outcome,
            "pick": pick, "correct_pick": pick == outcome if pick is not None else None,
            "log_loss": round(-math.log(max(probs[order.index(outcome)], 1e-15)), 8),
            "brier_score": round(sum((p - t) ** 2 for p, t in zip(probs, truth)), 8),
            "source_game": game["source_game"]
        })
    scores.sort(key=lambda x: x["match_id"])
    def stats(items):
        return {"scored": len(items), "mean_log_loss": mean([x["log_loss"] for x in items]),
                "mean_brier_score": mean([x["brier_score"] for x in items]),
                "pick_accuracy": mean([int(x["correct_pick"]) for x in items if x["pick"] is not None]),
                "unambiguous_picks": sum(x["pick"] is not None for x in items)}
    output = {
        "schema_version": 1, "status": "prospective_research_only",
        "model_archive": "data/college-soccer-prospective-v2.json",
        "count_locked": len(forecasts), "awaiting_final": len(forecasts) - len(scores),
        "overall": stats(scores),
        "cohorts": {c: stats([s for s in scores if s["cohort"] == c]) for c in COHORTS},
        "scores": scores, "quarantined": quarantine,
        "quarantined_count": len(quarantine),
        "brier_definition": "Sum of squared errors across away/draw/home; range 0 to 2.",
        "zero_probability_log_floor": 1e-15,
        "note": "Only exact match IDs and matching teams from verified final ledger are scored. Historical matches cannot count toward prospective validation."
    }
    OUTPUT.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n")
    print(f"Locked {len(forecasts)} | scored {len(scores)} | quarantined {len(quarantine)}")
    return output

if __name__ == "__main__":
    score()

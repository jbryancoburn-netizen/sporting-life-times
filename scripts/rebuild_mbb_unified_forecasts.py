#!/usr/bin/env python3
"""Rebuild published MBB win probabilities and margins from one RETRO snapshot."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

ratings = load("data/ncaam-2026-27-retro-primary.json")
cal = load("data/ncaam-score-calibration.json")
target = ROOT / "data/ncaam-2026-27-upcoming-forecasts.json"
forecasts = load("data/ncaam-2026-27-upcoming-forecasts.json")
elo = {r["team_id"]: float(r["elo"]) for r in ratings["rankings"]}
slope = float(cal["parameters"]["elo_margin_slope"])
cap = float(cal["parameters"]["margin_cap"])
home_bonus = float(ratings.get("parameters", {}).get("home_edge", 100))
for game in forecasts["games"]:
    away = elo.get(game["away_id"])
    home = elo.get(game["home_id"])
    if away is None or home is None:
        game["home_win_probability"] = None
        game["projected_home_margin"] = None
        game["forecast_model"] = "UNAVAILABLE_MISSING_RATING"
        continue
    # Unknown venues never receive an assumed home-court advantage.
    # Only source-verified home assignments qualify. Verified neutral stays zero.
    verified = game.get("venue_verification") == "verified_home" and bool(game.get("venue_source_url"))
    bonus = home_bonus if verified else 0
    gap = home - away + bonus
    game["home_win_probability"] = round(1 / (1 + 10 ** (-gap / 400)), 6)
    game["projected_home_margin"] = round(max(-cap, min(cap, gap * slope)), 3)
    game["home_court_elo_applied"] = bonus
    game["forecast_model"] = "retro-central-elo-neutral-until-verified-v1"
    game["ratings_as_of"] = ratings.get("as_of")
    game.setdefault("venue_verification", "unverified")
forecasts["forecast_method"] = {
    "version": "retro-central-elo-neutral-until-verified-v1",
    "ratings_source": "data/ncaam-2026-27-retro-primary.json",
    "score_calibration_source": "data/ncaam-score-calibration.json",
    "home_elo_bonus_verified_only": home_bonus,
    "unverified_venue_policy": "no home-court adjustment",
    "win_probability_formula": "1/(1+10^(-(home_elo-away_elo+verified_home_bonus)/400))",
    "projected_home_margin_formula": "clamp((home_elo-away_elo+verified_home_bonus)*elo_margin_slope,-margin_cap,+margin_cap)",
}
target.write_text(json.dumps(forecasts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Rebuilt {len(forecasts['games'])} MBB forecasts from RETRO {ratings.get('as_of')}")

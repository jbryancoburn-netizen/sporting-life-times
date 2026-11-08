#!/usr/bin/env python3
"""Fail closed before publishing contradictory RETRO MBB home-court forecasts.

No RETRO coefficients or rankings are modified by this validation gate.
"""
import copy
import json
import math
from pathlib import Path

from mbb_verified_home_sites import apply_verified_home_sites

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def validate(ratings, calibration, forecasts, sites, arenas, crosswalk):
    if ratings.get("model") != "retro-clean-slate" or ratings.get("starting_elo") != 1500:
        raise ValueError("Unexpected RETRO model or starting rating")
    elo = {r["team_id"]: float(r["elo"]) for r in ratings["rankings"]}
    if len(elo) != 365:
        raise ValueError("Expected exactly 365 independently rated Division I schools")
    slope = float(calibration["parameters"]["elo_margin_slope"])
    home_edge = float(ratings["parameters"]["home_edge"])
    if not (math.isfinite(slope) and slope > 0 and math.isfinite(home_edge)):
        raise ValueError("Invalid home advantage or spread slope")

    original = forecasts.get("games", [])
    if not isinstance(original, list) or not original:
        raise ValueError("Expected a populated forecast ledger")
    derived = copy.deepcopy(original)
    audit = apply_verified_home_sites(derived, crosswalk, sites, arenas)
    if len(original) != len(derived):
        raise ValueError("Venue classification altered fixture count")

    seen = set()
    for actual, expected in zip(original, derived):
        game_id = str(actual.get("id", ""))
        if not game_id or game_id in seen:
            raise ValueError("Missing or duplicate forecast game identifier: " + game_id)
        seen.add(game_id)
        if expected.get("venue_verification") != actual.get("venue_verification"):
            raise ValueError("Venue provenance mismatch: " + game_id)
        if expected.get("venue_verification") == "verified_home":
            for key in ("venue_source_url", "venue_evidence_method", "venue_evidence_key", "venue_arena"):
                if actual.get(key) != expected.get(key):
                    raise ValueError("Home court evidence mismatch for " + game_id + ": " + key)

        home = elo.get(actual.get("home_id"))
        away = elo.get(actual.get("away_id"))
        if home is None or away is None:
            raise ValueError("Unrated team in published schedule: " + game_id)
        verified = actual.get("venue_verification") == "verified_home" and bool(actual.get("venue_source_url"))
        bonus = home_edge if verified else 0
        gap = home - away + bonus
        probability = 1 / (1 + 10 ** (-gap / 400))
        projected = gap * slope
        if actual.get("home_court_elo_applied") != bonus:
            raise ValueError("Incorrect home advantage: " + game_id)
        if not math.isclose(actual.get("projected_home_margin", float("nan")), projected, abs_tol=0.003):
            raise ValueError("Incorrect published margin: " + game_id)
        if not math.isclose(actual.get("home_win_probability", float("nan")), probability, abs_tol=0.000002):
            raise ValueError("Incorrect published win probability: " + game_id)
        if actual.get("ratings_as_of") != ratings.get("as_of"):
            raise ValueError("Mismatch between forecast and current rating snapshot: " + game_id)
        if actual.get("forecast_model") != "retro-central-elo-uncapped-v2":
            raise ValueError("Unexpected forecast formula: " + game_id)

    if audit["verified_home"] + audit["unchanged_manual"] != sum(
        g.get("venue_verification") == "verified_home" or g.get("venue_verification") == "verified_neutral"
        for g in original
    ):
        raise ValueError("Verified venue count inconsistency")
    return {"status": "PASS", "fixtures": len(original), "official_home_matches": audit["verified_home"],
            "manual_home_or_neutral": audit["unchanged_manual"], "unverified": len(original)-
            audit["verified_home"]-audit["unchanged_manual"], "rating_date": ratings.get("as_of")}


if __name__ == "__main__":
    print(json.dumps(validate(
        load("data/ncaam-2026-27-retro-primary.json"),
        load("data/ncaam-score-calibration.json"),
        load("data/ncaam-2026-27-upcoming-forecasts.json"),
        load("data/mbb-slate-game-sites-2026-27.json"),
        load("data/mbb-arena-registry.json"),
        load("data/ncaam-2026-27-espn-team-crosswalk.json"),
    ), sort_keys=True))

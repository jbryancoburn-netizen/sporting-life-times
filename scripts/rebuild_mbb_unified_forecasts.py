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

from datetime import datetime
from zoneinfo import ZoneInfo

def merge_live_upcoming_fixtures(document):
    """Keep Eastern-today matchups in the single published forecast dataset.

    The rolling future fixture list can advance to tomorrow while evening games
    have not tipped off yet. Reconcile verified Division I identities from the
    independently refreshed scoreboard before recomputing any probabilities.
    """
    eastern = ZoneInfo("America/New_York")
    today = datetime.now(eastern).date().isoformat()
    feed = load("data/mbb-live.json")
    crosswalk = load("data/ncaam-2026-27-espn-team-crosswalk.json")
    canonical = {
        str(t["espn_id"]): str(t["id"])
        for t in crosswalk.get("teams", [])
        if t.get("espn_id") is not None and t.get("id")
    }
    existing = {str(g.get("id")): g for g in document["games"]}
    added = 0
    for item in feed.get("games", []):
        if item.get("state") != "pre":
            continue
        try:
            tip = datetime.fromisoformat(str(item["date"]).replace("Z", "+00:00"))
            day = tip.astimezone(eastern).date().isoformat()
        except (ValueError, TypeError, KeyError):
            continue
        if day < today:
            continue
        teams = item.get("teams") or []
        if len(teams) != 2:
            continue
        away = canonical.get(str(teams[0].get("id")))
        home = canonical.get(str(teams[1].get("id")))
        event_id = str(item.get("id", ""))
        if not (away and home and event_id.isdigit()):
            # Only publish D-I vs D-I forecasts with canonical team identities.
            continue
        key = "espn:" + event_id
        match = existing.get(key)
        if match is None:
            match = {
                "id": key, "date": day, "away_id": away, "home_id": home,
                "home_score": None, "away_score": None,
                "status": "scheduled_or_unconfirmed",
                "fixture_origin": "mbb-live-scoreboard",
                "venue_verification": "unverified",
            }
            document["games"].append(match)
            existing[key] = match
            added += 1
        else:
            # Source-verified schedule corrections must not leave a match
            # unmatchable in the Daily Ledger.
            match.update(date=day, away_id=away, home_id=home)
    document["games"].sort(key=lambda item: (item.get("date", ""), str(item.get("id", ""))))
    document["as_of"] = today
    document["live_fixture_source_updated_at"] = feed.get("scores_updated_at")
    return added

live_added = merge_live_upcoming_fixtures(forecasts)

elo = {r["team_id"]: float(r["elo"]) for r in ratings["rankings"]}
slope = float(cal["parameters"]["elo_margin_slope"])

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
    game["projected_home_margin"] = round(gap * slope, 3)
    game["home_court_elo_applied"] = bonus
    game["forecast_model"] = "retro-central-elo-uncapped-v2"
    game["ratings_as_of"] = ratings.get("as_of")
    game.setdefault("venue_verification", "unverified")
forecasts["forecast_method"] = {
    "version": "retro-central-elo-uncapped-v2",
    "ratings_source": "data/ncaam-2026-27-retro-primary.json",
    "score_calibration_source": "data/ncaam-score-calibration.json",
    "home_elo_bonus_verified_only": home_bonus,
    "unverified_venue_policy": "no home-court adjustment",
    "win_probability_formula": "1/(1+10^(-(home_elo-away_elo+verified_home_bonus)/400))",
    "validation_note": "Uncapped tail behavior not yet separately validated; historical capped calibration slope retained.",
    "projected_home_margin_formula": "(home_elo-away_elo+verified_home_bonus)*elo_margin_slope",
}
target.write_text(json.dumps(forecasts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Rebuilt {len(forecasts['games'])} MBB forecasts from RETRO {ratings.get('as_of')}; added {live_added} current/upcoming D-I fixtures")

"""Strict publication gates for NCAA Division I men's basketball Elo snapshots.

Input is a JSON object with teams, games, and ratings. This module does not
invent missing results, roster values, or team identities.
"""
import argparse
import json
import math
from pathlib import Path


def validate(snapshot):
    errors = []
    teams = snapshot.get("teams", [])
    games = snapshot.get("games", [])
    ratings = snapshot.get("ratings", [])
    ids = [t.get("id") for t in teams]
    if len(teams) != 365:
        errors.append(f"Expected 365 Division I teams; found {len(teams)}")
    if any(not x for x in ids) or len(set(ids)) != len(ids):
        errors.append("Team identifiers are missing or duplicated")
    known = set(ids)
    seen_games = set()
    for i, g in enumerate(games):
        gid = g.get("id")
        if not gid or gid in seen_games:
            errors.append(f"Game {i}: missing/duplicate game ID")
        seen_games.add(gid)
        if g.get("home_id") not in known or g.get("away_id") not in known:
            errors.append(f"Game {i}: unknown team")
        if g.get("home_id") == g.get("away_id"):
            errors.append(f"Game {i}: same opponent")
        for k in ("home_score", "away_score"):
            v = g.get(k)
            if not isinstance(v, int) or isinstance(v, bool) or v < 0:
                errors.append(f"Game {i}: invalid {k}")
        if not g.get("date"):
            errors.append(f"Game {i}: missing date")
    rated = [r.get("team_id") for r in ratings]
    if len(rated) != len(known) or set(rated) != known or len(set(rated)) != len(rated):
        errors.append("Ratings do not match unique team universe")
    for i, r in enumerate(ratings):
        v = r.get("elo")
        if not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v):
            errors.append(f"Rating {i}: nonfinite/missing Elo")
    if snapshot.get("season") == "2026-27" and snapshot.get("kind") == "preseason":
        if games:
            errors.append("Preseason snapshot cannot include 2026-27 regular-season games")
        if not snapshot.get("prior_season_final_reference"):
            errors.append("Missing immutable 2025-26 final reference")
        for i, r in enumerate(ratings):
            if r.get("roster_adjustment") is not None:
                if not r.get("roster_evidence_reference") or not r.get("adjustment_method_version"):
                    errors.append(f"Rating {i}: unverified roster adjustment")
    return errors


def main():
    p = argparse.ArgumentParser()
    p.add_argument("snapshot", type=Path)
    args = p.parse_args()
    data = json.loads(args.snapshot.read_text(encoding="utf-8"))
    errors = validate(data)
    print(json.dumps({"valid": not errors, "errors": errors}, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()

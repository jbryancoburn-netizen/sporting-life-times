#!/usr/bin/env python3
"""Release audit for the two independent NCAA Division II basketball editions.

This is deliberately offline: the publisher verifies the *actual* JSON that
would go live, rather than trusting a successful network request or an old
full-season-scan marker. No Division I files or ratings are read or written.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SEASON_START = dt.date(2026, 10, 1)
SEASON_END = dt.date(2027, 4, 15)


def audit_one(gender: str, data_dir: Path) -> tuple[dict, list[str]]:
    path = data_dir / f"d2-{gender}-2026-27.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if data.get("gender") != gender or data.get("season") != "2026-27":
        errors.append("wrong gender/season in source ledger")
    if data.get("division") != "II" or data.get("starting_elo") != 1500:
        errors.append("division or independent 1500 baseline changed")

    teams = data.get("teams") or []
    games = data.get("games") or []
    if not teams or not games:
        errors.append("team directory or scoreboard is empty")
    ids = [t.get("id") for t in teams]
    if len(ids) != len(set(ids)):
        errors.append("duplicate school identity")
    by_team = {t.get("id"): t for t in teams}
    game_ids: set[str] = set()
    pair_ids: dict[tuple, str] = {}
    expected_wins = Counter()
    expected_losses = Counter()
    finals = 0
    missing_venue = 0
    missing_network = 0
    missing_time = 0
    missing_source = 0
    source_categories = Counter()
    dates = set()
    warnings = []
    for game in games:
        gid = str(game.get("id", ""))
        if not gid or gid in game_ids:
            errors.append(f"empty/duplicate game ID {gid!r}")
        game_ids.add(gid)
        away, home = game.get("away"), game.get("home")
        if not away or not home or away == home or away not in by_team or home not in by_team:
            errors.append(f"{gid}: missing, identical or unknown school")
            continue
        try:
            when = dt.date.fromisoformat(str(game.get("date", "")))
            if not SEASON_START <= when <= SEASON_END:
                errors.append(f"{gid}: outside the 2026-27 season")
            dates.add(when.isoformat())
        except ValueError:
            errors.append(f"{gid}: invalid calendar date")
            continue
        key = (when.isoformat(), *sorted((away, home)))
        if key in pair_ids:
            errors.append(f"{gid}: matchup also published under {pair_ids[key]}")
        pair_ids[key] = gid
        if not game.get("venue"):
            missing_venue += 1
        if not game.get("network"):
            missing_network += 1
        if not game.get("start_time"):
            missing_time += 1
        if not game.get("source_url"):
            missing_source += 1
        source_categories[str(game.get("source", "unknown"))] += 1
        if game.get("status") != "final":
            continue
        scores = (game.get("away_score"), game.get("home_score"))
        if any(type(s) is not int or s < 0 for s in scores) or scores[0] == scores[1]:
            errors.append(f"{gid}: invalid final basketball score")
            continue
        if not game.get("elo_eligible"):
            continue
        if by_team[away].get("not_eligible_for_dii_elo") or by_team[home].get("not_eligible_for_dii_elo"):
            errors.append(f"{gid}: ineligible member counted in DII ratings")
            continue
        if not game.get("verified"):
            errors.append(f"{gid}: unrverified final counted in independent Elo")
            continue
        if not all(isinstance(game.get(k), (int, float)) for k in
                   ("pregame_elo_away", "pregame_elo_home", "pred_home_pct",
                    "elo_change_away", "elo_change_home")):
            errors.append(f"{gid}: Elo forecast/change not calculated")
            continue
        if abs(game["elo_change_away"] + game["elo_change_home"]) > 0.11:
            errors.append(f"{gid}: non-zero-sum Elo movement")
        if not 0 <= game["pred_home_pct"] <= 100:
            errors.append(f"{gid}: impossible game probability")
        if scores[0] > scores[1]:
            expected_wins[away] += 1
            expected_losses[home] += 1
        else:
            expected_wins[home] += 1
            expected_losses[away] += 1
        finals += 1

    for ident, team in by_team.items():
        if team.get("w", 0) != expected_wins[ident] or team.get("l", 0) != expected_losses[ident]:
            errors.append(f"{ident}: published W-L does not reconcile with finals")
        if not isinstance(team.get("elo"), (float, int)):
            errors.append(f"{ident}: missing current Elo")
    stored_finals = (data.get("quality") or {}).get("verified_dii_finals")
    if stored_finals != finals:
        errors.append(f"finals summary ({stored_finals}) != replayed count ({finals})")

    q = data.get("quality") or {}
    scan = q.get("full_season_scan") or {}
    complete_school_schedules = bool(scan.get("schedules_certified"))
    if not complete_school_schedules:
        warnings.append("A completed date scan is NOT a certified set of school schedules")
    if missing_source:
        warnings.append(f"{missing_source} fixtures have no traceable source URL")
    coverage = q.get("field_coverage") or {}
    output = {
        "gender": gender,
        "teams": len(teams),
        "games": len(games),
        "verified_elo_finals": finals,
        "dated_game_days": len(dates),
        "no_venue": missing_venue,
        "no_network": missing_network,
        "no_tipoff": missing_time,
        "no_source_url": missing_source,
        "schools_without_a_published_game": coverage.get("schools_with_no_published_fixtures"),
        "full_season_date_scan": bool(scan.get("completed")),
        "school_schedule_certified": complete_school_schedules,
        "source_categories": dict(sorted(source_categories.items())),
        "warnings": warnings,
        "release_errors": errors[:50],
        "release_error_count": len(errors),
    }
    return output, errors


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="Refuse release if school identity, scores or Elo are invalid")
    ap.add_argument("--data-dir", type=Path, default=DATA)
    args = ap.parse_args()
    men, men_errors = audit_one("men", args.data_dir)
    women, women_errors = audit_one("women", args.data_dir)

    # Institutional crests can be shared between the two editions; ratings,
    # game ledgers and athletes must never be shared. Report any colors that
    # disagree for one *exact* NCAA artwork slug, without guessing a winner.
    datasets = [json.loads((args.data_dir / f"d2-{g}-2026-27.json").read_text())
                for g in ("men", "women")]
    palettes: dict[str, dict] = {}
    for team in datasets[0]["teams"]:
        if team.get("slug"):
            palettes[team["slug"]] = team
    mismatch = []
    for team in datasets[1]["teams"]:
        other = palettes.get(team.get("slug"))
        if other and team.get("primary") and other.get("primary"):
            if (other.get("primary"), other.get("secondary")) != (team.get("primary"), team.get("secondary")):
                mismatch.append({"ncaa_logo": team["slug"],
                                 "men": other.get("id"), "women": team.get("id")})
    report = {
        "schema": 1,
        "season": "2026-27",
        "independent_elo_start": 1500,
        "status": "BLOCKED" if men_errors or women_errors else "PASS — school schedules remain uncertified",
        "men": men,
        "women": women,
        "cross_gender_logo_palette_conflicts": mismatch[:30],
        "cross_gender_logo_palette_conflict_count": len(mismatch),
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    outfile = args.data_dir / "d2-publishing-audit.json"
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if not outfile.exists() or outfile.read_text(encoding="utf-8") != serialized:
        outfile.write_text(serialized, encoding="utf-8")
    if args.strict and (men_errors or women_errors):
        raise SystemExit(f"BLOCKED DII publication: men {len(men_errors)} errors, women {len(women_errors)} errors")


if __name__ == "__main__":
    main()

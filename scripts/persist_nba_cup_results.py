#!/usr/bin/env python3
"""Persist verified NBA Cup finals from the existing NBA game-center and live scoreboard.

Only an exact Eastern date / away / home match can update a Cup fixture.
Existing results are never overwritten by a contradictory feed.
"""
import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CUP = ROOT / "data/nba-cup-2026.json"
SOURCES = (
    ("data/nba-game-center.json", ROOT / "data/nba-game-center.json"),
    ("data/nba-upcoming-schedule.json", ROOT / "data/nba-upcoming-schedule.json"),
)


def extract_final_matches(feed, source):
    matches = {}
    for game in feed.get("games", []):
        if game.get("state") != "post":
            continue
        sides = {side.get("home_away"): side for side in game.get("teams", [])}
        away, home = sides.get("away"), sides.get("home")
        if not away or not home or not game.get("date"):
            continue
        try:
            eastern_day = datetime.datetime.fromisoformat(
                game["date"].replace("Z", "+00:00")
            ).astimezone(ZoneInfo("America/New_York")).date().isoformat()
            a, h = away["code"], home["code"]
            away_score, home_score = int(away["score"]), int(home["score"])
            if away_score < 0 or home_score < 0 or away_score == home_score:
                continue
            key = f"{eastern_day}|{a}|{h}"
            matches[key] = {
                "away_score": away_score,
                "home_score": home_score,
                "game_id": game.get("id"),
                "source": source,
                "source_date": game["date"],
            }
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    return matches


def apply_results(doc, matches, conflicts=None):
    conflicts = conflicts or set()
    changed, rejected = 0, 0
    for fixture in doc["fixtures"]:
        key = fixture["key"]
        incoming = matches.get(key)
        if not incoming or key in conflicts:
            if key in conflicts:
                rejected += 1
            continue
        existing = fixture.get("result")
        if existing:
            if (existing.get("away_score"), existing.get("home_score")) != (
                incoming["away_score"], incoming["home_score"]
            ):
                rejected += 1
                print("CONFLICT existing Cup final:", key)
            continue
        fixture["result"] = incoming
        changed += 1
    return changed, rejected


def main():
    doc = json.loads(CUP.read_text(encoding="utf-8"))
    matches, conflicts, sources_used = {}, set(), []
    for label, path in SOURCES:
        if not path.is_file():
            continue
        feed = json.loads(path.read_text(encoding="utf-8"))
        observed = extract_final_matches(feed, label)
        sources_used.append(f"{label} ({len(observed)} finals)")
        for key, result in observed.items():
            if key in matches and (
                matches[key]["away_score"], matches[key]["home_score"]
            ) != (result["away_score"], result["home_score"]):
                conflicts.add(key)
                print("CONFLICT between NBA feeds:", key)
            else:
                matches[key] = result
    if not sources_used:
        raise SystemExit("No NBA score sources available; preserve Cup ledger")
    changed, rejected = apply_results(doc, matches, conflicts)
    if changed:
        doc["results_synced_at"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        CUP.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(
        "NBA Cup: sources", ", ".join(sources_used),
        "| new finals", changed,
        "| conflicting results held", rejected,
        "| total finals", sum(bool(f.get("result")) for f in doc["fixtures"]),
    )


if __name__ == "__main__":
    main()

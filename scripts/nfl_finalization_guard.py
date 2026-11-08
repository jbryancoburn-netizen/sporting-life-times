#!/usr/bin/env python3
"""Guard NFL game finalization against missing season records or box scores."""
import argparse
import copy
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EDITION = ROOT / "data/nfl-2026-edition.json"
LIVE = ROOT / "data/nfl-live.json"
BOXES = ROOT / "data/nfl-2026-boxscores.json"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def compare(edition, live, boxes):
    if edition.get("season") != 2026 or live.get("season") != 2026:
        raise ValueError("Mismatched NFL source seasons")
    canonical = {str(g["id"]): g for g in edition.get("games", [])}
    published_boxes = boxes.get("games") or {}
    unfinished, missing_boxes = [], []
    for sourced in live.get("games", []):
        if sourced.get("state") != "post":
            continue
        event = str(sourced["id"])
        published = canonical.get(event)
        if not published or published.get("state") != "post" or any(
            published.get(side, {}).get("score") != sourced.get(side, {}).get("score")
            for side in ("home", "away")
        ):
            unfinished.append(event)
        if event not in published_boxes:
            missing_boxes.append(event)
    return unfinished, missing_boxes



def overlay_recent_live_finals(games, live, now):
    """Ingest fresh verified scoreboard finals when ESPN's weekly cache lags.

    A live update must be fresh, regular-season identified by a canonical game,
    and have the same two team IDs. Never infer a result from in-game scores.
    """
    if live.get("season") != 2026:
        return games
    try:
        stamp = dt.datetime.fromisoformat(live["updated_at"].replace("Z", "+00:00"))
        age = (now - stamp).total_seconds()
    except (ValueError, TypeError, KeyError):
        return games
    if stamp.tzinfo is None or not 0 <= age <= 900:
        return games
    merged = dict(games)
    for sourced in live.get("games", []):
        if sourced.get("state") != "post":
            continue
        event = str(sourced.get("id"))
        canonical = merged.get(event)
        if not canonical or any(
            str(canonical.get(side, {}).get("id")) != str(sourced.get(side, {}).get("id"))
            for side in ("away", "home")
        ):
            continue
        scores = [sourced.get(side, {}).get("score") for side in ("away", "home")]
        if not all(isinstance(x, int) and x >= 0 for x in scores):
            continue
        updated = copy.deepcopy(canonical)
        updated["state"] = "post"
        updated["status"] = sourced.get("status") or "Final"
        for side in ("away", "home"):
            score = sourced[side]["score"]
            if updated[side].get("score") != score:
                updated[side]["linescores"] = []
            updated[side]["score"] = score
            lines = sourced[side].get("linescores") or []
            if lines and all(isinstance(x, dict) and isinstance(x.get("score"), int)
                             and x["score"] >= 0 for x in lines) and sum(
                                 x["score"] for x in lines
                             ) == score:
                updated[side]["linescores"] = lines
        merged[event] = updated
    return merged

def verify(edition, live, boxes):
    unfinished, missing_boxes = compare(edition, live, boxes)
    if unfinished:
        raise ValueError("NFL finals missing from season ledger: " + ", ".join(unfinished))
    finals = [g for g in edition.get("games", []) if g.get("state") == "post"]
    teams = edition.get("teams", [])
    if len(edition.get("games", [])) != 272 or len(teams) != 32:
        raise ValueError("Incomplete certified NFL season")
    if sum(int(t.get("played", 0)) for t in teams) != 2 * len(finals):
        raise ValueError("Final count disagrees with published team records")
    if edition.get("coverage", {}).get("finals") != len(finals):
        raise ValueError("Coverage count disagrees with certified finals")
    if missing_boxes:
        print("NFL box-score recovery pending:", ", ".join(missing_boxes))
    else:
        print("All sourced finals reflected in season records and box scores")
    return missing_boxes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("needs-refresh", "verify"))
    args = parser.parse_args()
    edition, live, boxes = read(EDITION), read(LIVE), read(BOXES)
    if args.action == "needs-refresh":
        unfinished, missing_boxes = compare(edition, live, boxes)
        if unfinished or missing_boxes:
            print("NFL finalization needed: games", unfinished, "box scores", missing_boxes)
            return 0
        return 1
    verify(edition, live, boxes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

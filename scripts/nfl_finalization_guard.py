#!/usr/bin/env python3
"""Guard NFL game finalization against missing season records or box scores."""
import argparse
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

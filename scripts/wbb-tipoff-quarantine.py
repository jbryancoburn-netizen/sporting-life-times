#!/usr/bin/env python3
"""Maintain the women-only, source-linked quarantine of disputed 2026–27 tipoffs.

Never infer the correct kickoff/timezone from conflicts: preserve each official
claim and leave the event organizer to certify the actual start time.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"
OFFICIAL = "ncaaw-2026-27-official-field-crosschecks.json"
OPPONENT = "ncaaw-2026-27-cross-school-time-discrepancies-2026-10-30.json"
OUTPUT = "ncaaw-2026-27-tipoff-quarantine.json"
POLICY = ("Never promote a disputed university/ESPN tipoff to official; "
          "do not silently substitute the published game timestamp. "
          "Actual completed results remain separate.")


def build(root=ROOT):
    a = json.loads((root / OFFICIAL).read_text(encoding="utf-8"))
    b = json.loads((root / OPPONENT).read_text(encoding="utf-8"))
    if a.get("season") != "2026-27" or a.get("gender") != "women":
        raise ValueError("Wrong season or sport in university tipoff evidence")
    if b.get("season") != "2026-27":
        raise ValueError("Wrong season in opponent timetable evidence")
    items = {}
    claims = a.get("official_tipoff_discrepancies_for_review")
    if not isinstance(claims, list):
        raise ValueError("Official dispute source is absent")
    for row in claims:
        key = str(row.get("game_id", ""))
        src = row.get("source_url", "")
        if not re.fullmatch(r"\d+", key) or not src.startswith("https://"):
            raise ValueError("Missing identified game or independent school source")
        g = items.setdefault(key, {
            "game_id": key,
            "calendar_utc": row.get("calendar_utc", ""),
            "source_claims": [],
            "cross_school_disagreement": False,
        })
        claim = {
            "team_id": str(row["team_id"]),
            "printed_time": row["official_time"],
            "source_url": src,
        }
        if claim not in g["source_claims"]:
            g["source_claims"].append(claim)
    for row in b.get("games", []):
        key = str(row.get("game_id", ""))
        if not re.fullmatch(r"\d+", key):
            raise ValueError("Opponent time disagreement lacks a numeric game ID")
        g = items.setdefault(key, {
            "game_id": key,
            "calendar_utc": row.get("existing_calendar_utc", ""),
            "source_claims": [],
            "cross_school_disagreement": False,
        })
        g["cross_school_disagreement"] = bool(row.get("california_printed")
                                               and row.get("hawaii_printed"))
        g["review_note"] = row.get("outcome", "")
        g["additional_sources"] = [
            source for source in row.get("sources", [])
            if isinstance(source, str) and source.startswith("https://")
        ]
    if not items:
        raise ValueError("Empty quarantine would conceal all disputed starts")
    return {
        "season": "2026-27",
        "gender": "women",
        "status": "unresolved-source-conflicts",
        "policy": POLICY,
        "source_files": ["data/" + OFFICIAL, "data/" + OPPONENT],
        "source_claim_count": len(claims),
        "disputed_unique_games": len(items),
        "games": [items[k] for k in sorted(items)],
    }


def main():
    result = build()
    target = ROOT / OUTPUT
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if not target.exists() or target.read_text(encoding="utf-8") != content:
        target.write_text(content, encoding="utf-8")
    print("WBB tipoff quarantine:", result["source_claim_count"],
          "official conflicts,", result["disputed_unique_games"], "unique games")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build a small SLT scorecard venue index using only game-specific official school fixtures.

No home-arena default assignment. Exact Eastern game date and both oriented ESPN
team IDs are required to join it to the live scoreboard. Conflicts are quarantined.
"""
from __future__ import annotations
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "data" / "mbb-schedules-2026-27"
OUTPUT = ROOT / "data" / "mbb-slate-game-sites-2026-27.json"
SUFFIX = {"Pa": "PA", "Ky": "KY", "N.C": "NC", "S.C": "SC", "Va": "VA", "Fla": "FL", "Tex": "TX", "Calif": "CA"}
INVALID = ("tba", "tbd", "unknown", "unconfirmed", "to be announced", "n/a", "--", "campus", "home", "away")
ARENA_PATTERN = re.compile(r"[a-zA-Z]")
URL = re.compile(r"^https://[^ ]+$")


def clean(text):
    if not isinstance(text, str):
        return ""
    value = " ".join(text.split()).strip(" ,.;")
    if not value or value.lower() in INVALID:
        return ""
    return value


def date(value):
    return str(value or "")[:10] if re.match(r"^202[67]-\d{2}-\d{2}", str(value or "")) else ""


def city_state(venue):
    address = venue.get("address") if isinstance(venue.get("address"), dict) else {}
    city = clean(address.get("city"))
    state = clean(address.get("state"))
    if not city:
        compound = clean(venue.get("official_school_city"))
        if compound and "," in compound:
            left, right = compound.rsplit(",", 1)
            city = clean(left)
            state = state or clean(right)
    state = SUFFIX.get(state, state)
    if state and len(state) <= 3:
        state = state.upper()
    return city, state


def candidate(event, filepath):
    if event.get("official_source") is not True or event.get("site_verified") is not True:
        return None
    if event.get("neutralSite") not in (True, False):
        return None
    stamp = date(event.get("date"))
    if not stamp:
        return None
    competitions = event.get("competitions") or []
    if not isinstance(competitions, list) or not competitions:
        return None
    contest = competitions[0]
    if not isinstance(contest, dict):
        return None
    teams = contest.get("competitors") or []
    if not isinstance(teams, list) or len(teams) != 2:
        return None
    sides = {str(p.get("homeAway")): str((p.get("team") or {}).get("id") or "") for p in teams if isinstance(p, dict)}
    away, home = sides.get("away", ""), sides.get("home", "")
    if not away.isdigit() or not home.isdigit() or away == home:
        return None
    # It must be the school's actual published event, not an unrelated inferred opponent.
    if str(filepath.stem) not in (away, home):
        return None
    site = contest.get("venue") or {}
    if not isinstance(site, dict):
        return None
    arena = clean(site.get("arenaName"))
    if arena and (len(arena) > 110 or not ARENA_PATTERN.search(arena) or arena.lower().startswith("arena t")):
        arena = ""
    city, state = city_state(site)
    if not arena and not city:
        return None
    source = next((x for x in (
        event.get("site_source_url"), site.get("arena_source_url"),
        site.get("source_url"), event.get("school_source_url")
    ) if isinstance(x, str) and URL.match(x)), "")
    if not source:
        return None
    return stamp + "|" + away + "|" + home, {
        "arena": arena, "city": city, "state": state,
        "neutral": event.get("neutralSite") is True,
        "source": source, "school": str(filepath.stem)
    }


def compatible(a, b):
    for key in ("arena", "city", "state"):
        if a[key] and b[key] and re.sub(r"\W", "", a[key].lower()) != re.sub(r"\W", "", b[key].lower()):
            return False
    return a["neutral"] == b["neutral"]


def build():
    staging = defaultdict(list)
    total = 0
    for path in sorted(FOLDER.glob("*.json")):
        if not path.stem.isdigit():
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(raw, dict):
            continue
        for event in raw.get("events") or []:
            if not isinstance(event, dict):
                continue
            entry = candidate(event, path)
            if entry:
                key, value = entry
                staging[key].append(value)
                total += 1
    games = {}
    conflicts = []
    for key, entries in sorted(staging.items()):
        first = entries[0]
        if any(not compatible(first, entry) for entry in entries[1:]):
            conflicts.append(key)
            continue
        richest = max(entries, key=lambda e: (bool(e["arena"]) + bool(e["city"]), bool(e["arena"])))
        merged = {field: next((entry[field] for entry in entries if entry[field]), "")
                  for field in ("arena", "city", "state")}
        games[key] = {**merged, "neutral": richest["neutral"], "source": richest["source"],
                      "verification": "exact_official_game_site"}
    report = {
        "schema": "slt-slate-game-sites-v1",
        "season": "2026-27",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "method": "Official-source per-game venues, matched on exact date + away ESPN ID + home ESPN ID. Not a home arena default.",
        "total_official_site_rows": total,
        "verified_game_sites": len(games),
        "games_with_arena_and_city": sum(bool(g["arena"] and g["city"]) for g in games.values()),
        "conflicting_matchups_skipped": len(conflicts),
        "conflict_keys": conflicts[:100],
        "games": games
    }
    if len(games) < 100:
        raise SystemExit(f"Source venue index suspiciously small: {len(games)}")
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("total_official_site_rows", "verified_game_sites",
                                          "games_with_arena_and_city", "conflicting_matchups_skipped")},
                     indent=2))
    print("Sample UT Knoxville:", json.dumps(games.get("2026-11-03|2747|2633")))


if __name__ == "__main__":
    build()

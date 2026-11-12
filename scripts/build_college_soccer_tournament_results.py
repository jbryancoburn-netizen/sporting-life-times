#!/usr/bin/env python3
"""Publish real NCAA men's Division I scores for all conference tournament desks.

Official brackets are kept separate from these NCAA scores. A game between
conference members near the championship window is NOT, by itself, proof of its
round, tournament eligibility, or shootout advancement. Never replace an
official result with RETRO or infer a penalty shootout winner from a tie.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
from datetime import date
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = DATA / "college-soccer-conference-tournament-results-2026.json"
GAME_SOURCE = re.compile(r"https://www\.ncaa\.com/game/\d+$")
SEASON = 2026
DEFAULT_START = date(SEASON, 11, 1)


def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def result_start(tournament):
    fields = ("first_round_date", "quarterfinal_date", "semifinal_date",
              "semifinals_date", "final_date")
    dates = []
    for field in fields:
        value = tournament.get(field)
        if not isinstance(value, str):
            continue
        try:
            d = date.fromisoformat(value)
        except ValueError:
            continue
        if d.year == SEASON:
            dates.append(d)
    # The published schedule may omit early rounds, so include all November
    # games but do NOT claim any match is a tournament game without a bracket.
    return min(DEFAULT_START, *dates) if dates else DEFAULT_START


def merge_finals(ledger, season):
    by_id = {}
    for source in (season.get("results", []), ledger.get("results", [])):
        for m in source:
            if m.get("gender") != "men":
                continue
            mid = m.get("match_id")
            if not mid:
                continue
            source_url = m.get("source_game", "")
            if not isinstance(source_url, str) or not GAME_SOURCE.fullmatch(source_url):
                continue
            home, away = m.get("home_team"), m.get("away_team")
            if not home or not away or home == away:
                continue
            try:
                when = date.fromisoformat(m["date"])
                hs, as_ = m["home_goals"], m["away_goals"]
            except (ValueError, TypeError, KeyError):
                continue
            if when.year != SEASON or type(hs) is not int or type(as_) is not int:
                continue
            if min(hs, as_) < 0 or max(hs, as_) > 40:
                continue
            normalized = {"match_id": mid, "date": when.isoformat(),
                          "home_id": home, "away_id": away,
                          "home_score": hs, "away_score": as_,
                          "source_url": source_url, "status": "final",
                          "winner_id": (home if hs > as_ else away if as_ > hs else None)}
            before = by_id.get(mid)
            if before and before != normalized:
                raise ValueError("Conflicting NCAA final for " + mid)
            by_id[mid] = normalized
    return by_id


def compile_scores(directory, rules, final_records, as_of):
    conferences = {}
    for key, info in directory["conferences"].items():
        if not key.startswith("men-d1:"):
            continue
        members = set(info.get("teams", []))
        if not members:
            raise ValueError("Missing member list: " + key)
        rule = rules["conferences"].get(key, {})
        tournament = rule.get("tournament") or {}
        start = result_start(tournament)
        rows = [
            {**game, "round_certified": False, "tournament_game_certified": False}
            for game in final_records.values()
            if game["home_id"] in members and game["away_id"] in members
               and game["date"] >= start.isoformat()
        ]
        rows.sort(key=lambda m: (m["date"], m["match_id"]), reverse=True)
        # Keep a manageable page and avoid the false implication that this is
        # the complete championship bracket.
        conferences[key] = {
            "conference_name": info.get("name", key),
            "page": info.get("page"),
            "window_start": start.isoformat(),
            "source_checked_through": as_of,
            "classification": "ncaa_verified_intra_conference_finals_round_unverified",
            "round_certified": False,
            "note": ("Actual NCAA final scores between conference members since the listed window. "
                     "Participation in the conference tournament, round and advancement are "
                     "NOT independently certified by these results alone."),
            "games": rows[:32],
            "total_verified_window_games": len(rows),
        }
    if len(conferences) != 23:
        raise ValueError(f"Expected all 23 Division I men's conferences, found {len(conferences)}")
    return conferences


def build():
    directory = read("college-soccer-conferences.json")
    rules = read("college-soccer-postseason-rules.json")
    ledger = read("college-soccer-elo-final-ledger.json")
    season = read("college-soccer-season-finals-2026.json")
    audit = read("college-soccer-elo-live-audit.json")
    final_records = merge_finals(ledger, season)
    payload = {
        "schema_version": 1,
        "season": SEASON,
        "scope": "men-d1",
        "source": "NCAA.com verified finals from the existing college soccer ledger",
        "source_checked_through": audit.get("checked_through"),
        "classification_warning": "Conference membership and date do not certify a tournament matchup or winner of a tied playoff.",
        "conferences": compile_scores(directory, rules, final_records, audit.get("checked_through")),
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    nonempty = [(key,len(c["games"])) for key,c in payload["conferences"].items() if c["games"]]
    print(f"NCAA-verified recent results: {len(nonempty)}/23 conferences with games, "
          f"{sum(n for _,n in nonempty)} game records; "
          f"source checked {payload['source_checked_through']}")
    return payload


def self_test():
    a = {"match_id": "men-101", "gender": "men", "date": "2026-11-10",
         "home_team": "american", "away_team": "bucknell",
         "home_goals": 1, "away_goals": 2,
         "source_game": "https://www.ncaa.com/game/101"}
    b = {"match_id": "men-102", "gender": "men", "date": "2026-11-11",
         "home_team": "washington", "away_team": "rutgers",
         "home_goals": 1, "away_goals": 1,
         "source_game": "https://www.ncaa.com/game/102"}
    scores = merge_finals({"results": [a,b]}, {"results":[a]})
    assert len(scores) == 2
    assert scores["men-101"]["winner_id"] == "bucknell"
    assert scores["men-102"]["winner_id"] is None
    assert result_start({"first_round_date":"2026-11-07"}) == DEFAULT_START
    assert result_start({}) == DEFAULT_START
    try:
        merge_finals({"results":[{**a,"home_goals":9}]},{"results":[a]})
    except ValueError:
        pass
    else:
        raise AssertionError("Conflicting results accepted")
    print("PASS: real scores, no shootout winner inference, duplicates and conflicts guarded")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    self_test() if args.self_test else build()

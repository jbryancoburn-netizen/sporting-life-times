#!/usr/bin/env python3
"""Publish certified NCAA men's soccer scores into already-announced conference brackets.

This does NOT construct brackets, guess tournament pairings, or award penalties.
Only official fixtures with a date and two known opponents can receive a
score from a unique NCAA final-score record. A tied knockout is withheld until
a verified conference result supplies the penalty winner.
"""
from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MONTHS = {"NOV": 11, "OCT": 10, "DEC": 12}


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def fixture_date(label):
    match = re.search(r"\b(OCT|NOV|DEC)(?:EMBER|OBER)?\s+(\d{1,2})\b", str(label or ""), re.I)
    if not match:
        return None
    return date(2026, MONTHS[match.group(1).upper()[:3]], int(match.group(2)))


def verified_score(match, results):
    home, away = match.get("home_id"), match.get("away_id")
    when = fixture_date(match.get("round"))
    if not home or not away or home == away or not when:
        return None
    options = []
    for item in results:
        if item.get("gender") != "men":
            continue
        if {item.get("home_team"), item.get("away_team")} != {home, away}:
            continue
        try:
            played = date.fromisoformat(item["date"])
            if abs((played - when).days) > 1:
                continue  # Includes resumed matches after weather delays.
            a, b = int(item["home_goals"]), int(item["away_goals"])
            if a < 0 or b < 0:
                continue
        except (ValueError, KeyError, TypeError):
            continue
        # NCAA and conference brackets can display opposite venue orientations.
        hs, vs = (a, b) if item["home_team"] == home else (b, a)
        if hs == vs:
            continue  # Final draw is not a verified knockout winner.
        src = str(item.get("source_game", ""))
        if not re.fullmatch(r"https://www\.ncaa\.com/game/\d+", src):
            continue
        options.append((hs, vs, src, item["date"]))
    distinct = {(a, b) for a, b, _, _ in options}
    if len(distinct) > 1:
        raise ValueError("Conflicting NCAA results for " + home + " vs " + away)
    if not options:
        return None
    hs, vs, url, played = sorted(options)[0]
    return dict(home_score=hs, away_score=vs,
                winner_id=home if hs > vs else away,
                status="final", source_url=url, result_date=played)


def update_all():
    directory = load("college-soccer-conferences.json")
    ledger = load("college-soccer-elo-final-ledger.json")
    seasonal = load("college-soccer-season-finals-2026.json")
    records = list(ledger.get("results", [])) + list(seasonal.get("results", []))
    changed_files = []
    unresolved = []
    checked = 0
    for key, meta in directory.get("conferences", {}).items():
        if not key.startswith("men-d1:"):
            continue
        feed = meta.get("standings_feed")
        if not feed or not (ROOT / feed).is_file():
            continue
        path = ROOT / feed
        table = json.loads(path.read_text(encoding="utf-8"))
        bracket = table.get("tournament_bracket")
        if not (isinstance(bracket, dict) and bracket.get("status") == "official"
                and str(bracket.get("source_url", "")).startswith("https://")):
            continue
        membership = set(meta.get("teams", []))
        if not membership:
            continue
        dirty = False
        for match in bracket.get("matches", []):
            if match.get("status") == "final":
                continue
            if not {match.get("home_id"), match.get("away_id")} <= membership:
                continue
            if not match.get("home_id") or not match.get("away_id"):
                continue
            checked += 1
            result = verified_score(match, records)
            if result:
                match.update(result)
                dirty = True
                print(f"FINAL {key}: {match['home_id']} {result['home_score']} - "
                      f"{result['away_score']} {match['away_id']} [{result['source_url']}]")
            else:
                # A scoreless/unresolved game remains clearly unconfirmed.
                unresolved.append(f"{key}: {match.get('round')} "
                                  f"{match['home_id']} vs {match['away_id']}")
        if dirty:
            dates = [m.get("result_date") for m in bracket["matches"] if m.get("result_date")]
            if dates:
                bracket["verified_through"] = max(
                    [bracket.get("verified_through", "")] + dates)
            path.write_text(json.dumps(table, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
            changed_files.append(str(path.relative_to(ROOT)))
    print(f"Official NCAA soccer bracket reconciliation: {len(changed_files)} "
          f"updated files, {checked} pending known fixtures checked; "
          f"{len(unresolved)} pending/not independently confirmed")
    return changed_files


def self_test():
    template = {"round": "CHAMPIONSHIP · NOV 14",
                "home_id": "saint-louis", "away_id": "fordham"}
    records = [{"date": "2026-11-14", "gender": "men",
                "home_team": "fordham", "away_team": "saint-louis",
                "home_goals": 0, "away_goals": 2,
                "source_game": "https://www.ncaa.com/game/123456"}]
    assert verified_score(template, records) == {
        "home_score": 2, "away_score": 0, "winner_id": "saint-louis",
        "status": "final", "source_url": "https://www.ncaa.com/game/123456",
        "result_date": "2026-11-14"}
    assert verified_score(template, [{**records[0], "away_goals": 0}]) is None
    assert verified_score(template, [{**records[0], "date": "2026-10-14"}]) is None
    assert fixture_date("QUARTERFINALS · NOV 7 (RESUMED)") == date(2026, 11, 7)
    print("PASS: conference score matching, home/away reversal, and draw safety")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    self_test() if args.self_test else update_all()

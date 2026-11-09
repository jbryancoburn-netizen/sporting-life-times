#!/usr/bin/env python3
"""Freeze published pregame RETRO forecasts, then score confirmed D-I finals.
This program NEVER reconstructs predictions from a postgame rating.
Only schedules beyond today's UTC date are frozen (no verified tip time in source).
"""
import json
import os
import pathlib
from datetime import datetime, timezone
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ARCHIVE = DATA / "retro-pregame-archive-2026-27.json"
REPORT = DATA / "retro-spread-accuracy-2026-27.json"
SOURCE = DATA / "ncaam-2026-27-upcoming-forecasts.json"
FINALS = DATA / "ncaam-2026-27-retro-primary.json"
SEASON = "2026-27"

def load(path, default=None):
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(path)
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)

def write_if_changed(path, obj):
    content = json.dumps(obj, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True

def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)

def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    today = now[:10]
    source = load(SOURCE)
    finals = load(FINALS)
    if source.get("season") != SEASON or finals.get("season") != SEASON:
        raise ValueError("Wrong season in source data; refusing to score")
    archived = load(ARCHIVE, {"season": SEASON, "predictions": []})
    if archived.get("season") != SEASON:
        raise ValueError("Archive season mismatch")
    records = archived["predictions"]
    if not isinstance(records, list):
        raise ValueError("Invalid archive")
    keys = {(p["date"], p["id"]) for p in records}
    added = 0
    for p in source.get("games", []):
        date, event_id = p.get("date"), p.get("id")
        if not isinstance(date, str) or not isinstance(event_id, str) or date <= today:
            continue  # protect against retrospective or same-day post-tip snapshots
        margin, probability = p.get("projected_home_margin"), p.get("home_win_probability")
        if not numeric(margin) or not numeric(probability) or not 0 <= probability <= 1:
            continue
        key = (date, event_id)
        if key in keys:
            continue
        records.append({
            "date": date, "id": event_id, "home_id": p.get("home_id"),
            "away_id": p.get("away_id"), "projected_home_margin": margin,
            "home_win_probability": probability,
            "forecast_model": p.get("forecast_model"),
            "ratings_as_of": p.get("ratings_as_of"),
            "venue_verification": p.get("venue_verification", "unknown"),
            "captured_at_utc": now, "source_as_of": source.get("as_of")
        })
        keys.add(key)
        added += 1
    records.sort(key=lambda x: (x["date"], x["id"]))
    archived["predictions"] = records
    # The archive is append-only. Do not mutate the original forecasts after capture.
    final_by_key = {(e["date"], e["id"]): e for e in finals.get("events", [])
                    if e.get("date") and e.get("id") and numeric(e.get("home_score"))
                    and numeric(e.get("away_score"))}
    matched = []
    pending = 0
    for p in records:
        f = final_by_key.get((p["date"], p["id"]))
        if not f:
            pending += 1
            continue
        if (str(f.get("home_id")) != str(p.get("home_id")) or
                str(f.get("away_id")) != str(p.get("away_id"))):
            raise ValueError("Team mismatch for event " + p["id"])
        actual = f["home_score"] - f["away_score"]
        prediction = p["projected_home_margin"]
        home_wins = actual > 0
        matched.append({
            "date": p["date"], "id": p["id"],
            "home_id": p["home_id"], "away_id": p["away_id"],
            "predicted_home_margin": prediction, "actual_home_margin": actual,
            "absolute_margin_error": round(abs(prediction - actual), 4),
            "predicted_home_win_probability": p["home_win_probability"],
            "winner_correct": (p["home_win_probability"] >= 0.5) == home_wins,
            "brier": round((p["home_win_probability"] - int(home_wins)) ** 2, 8),
            "forecast_model": p.get("forecast_model"),
            "captured_at_utc": p["captured_at_utc"]
        })
    def metrics(rows):
        n = len(rows)
        return {"games": n, "correct_winners": sum(v["winner_correct"] for v in rows),
                "winner_accuracy": round(sum(v["winner_correct"] for v in rows) / n, 5) if n else None,
                "margin_mae": round(sum(v["absolute_margin_error"] for v in rows) / n, 4) if n else None,
                "brier": round(sum(v["brier"] for v in rows) / n, 6) if n else None}
    groups = defaultdict(list)
    for row in matched:
        groups[row["date"]].append(row)
    report = {
        "season": SEASON, "sport": "NCAA men's Division I basketball",
        "method": "Immutable before-game-day forecasts versus verified in-season D-I finals",
        "updated_at_utc": now, "archived_predictions": len(records),
        "pending_finals": pending, "summary": metrics(matched),
        "by_date": {day: metrics(rows) for day, rows in sorted(groups.items())},
        "games": sorted(matched, key=lambda x: (x["date"], x["id"]))
    }
    # Report changes on every run, but GitHub will commit only on newly captured/scored games.
    write_if_changed(ARCHIVE, archived)
    write_if_changed(REPORT, report)
    print(f"RETRO: +{added} captured; {len(records)} archived; {len(matched)} scored; {pending} pending")
    print(json.dumps(report["summary"], sort_keys=True))

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Publish women's live display scores independently from finals and ratings."""
import datetime as dt
import json
from pathlib import Path

from refresh_mbb_live_scores import EASTERN, eastern_day
from refresh_mbb_newspaper import fetch_scoreboards

PATH = Path(__file__).resolve().parents[1] / "data" / "wbb-live.json"
PHASE = {"pre": 0, "in": 1, "post": 2}


def compact(event):
    contests = event.get("competitions") or []
    if not contests:
        return None
    contest = contests[0]
    teams = contest.get("competitors") or []
    status = event.get("status") or {}
    phase = (status.get("type") or {}).get("state")
    if ({t.get("homeAway") for t in teams} != {"home", "away"} or len(teams) != 2
            or phase not in PHASE):
        return None
    ordered = sorted(teams, key=lambda t: t["homeAway"])
    ids = [str((t.get("team") or {}).get("id", "")) for t in ordered]
    if len(set(ids)) != 2 or not all(value.isdigit() for value in ids):
        return None
    slim = {key: contest[key] for key in ("venue", "broadcasts", "geoBroadcasts", "neutralSite",
                                         "possession", "situation", "lastPlay", "leaders") if key in contest}
    slim["competitors"] = [
        {key: t[key] for key in ("homeAway", "score", "timeoutsRemaining") if key in t}
        | {"team": {key: t["team"][key] for key in ("id", "displayName", "abbreviation") if key in t["team"]}}
        for t in ordered
    ]
    return {"id": str(event["id"]), "date": event.get("date") or contest.get("date"),
            "status": status, "competitions": [slim]}


def merge(previous, events, now):
    today = now.astimezone(EASTERN).date()
    first_day = (today - dt.timedelta(days=3)).isoformat()
    day = today.isoformat()
    retained = {g["id"]: g for g in previous if first_day <= eastern_day(g["date"]) <= day}
    for raw in events:
        game = compact(raw)
        if not game or eastern_day(game["date"]) != day:
            continue
        prior = retained.get(game["id"])
        if prior:
            before = prior["competitions"][0]["competitors"]
            after = game["competitions"][0]["competitors"]
            if [t["team"]["id"] for t in before] != [t["team"]["id"] for t in after]:
                continue
            if PHASE[prior["status"]["type"]["state"]] > PHASE[game["status"]["type"]["state"]]:
                continue
            if prior["status"]["type"]["state"] == game["status"]["type"]["state"] == "in":
                try:
                    if any(int(a["score"]) < int(b["score"]) for b, a in zip(before, after)):
                        continue
                except (KeyError, TypeError, ValueError):
                    continue
        retained[game["id"]] = game
    return sorted(retained.values(), key=lambda g: (g["date"], g["id"]))


def main():
    now = dt.datetime.now(dt.timezone.utc)
    previous = json.loads(PATH.read_text()) if PATH.exists() else {}
    source, _ = fetch_scoreboards(now.astimezone(EASTERN).strftime("%Y%m%d"), women=True)
    events = merge(previous.get("events", []), source["events"], now)
    if PATH.exists() and events == previous.get("events"):
        print("Women's live scoreboard already current.")
        return
    PATH.write_text(json.dumps({"edition": "women", "checked_at": now.isoformat(), "events": events},
                               separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Women's live scoreboard captured {len(events)} games.")


if __name__ == "__main__":
    main()

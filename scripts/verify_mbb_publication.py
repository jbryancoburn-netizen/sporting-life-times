#!/usr/bin/env python3
"""Verify the deployed MBB score feed against the staged source.

Works on pregame mornings, during live games, after finals and on off-days.
A successful Pages upload is NOT enough; the actual public JSON must agree.
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/New_York")


def when(value):
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)


def on_date(game, day):
    try:
        return when(game["date"]).astimezone(EASTERN).date() == day
    except (TypeError, ValueError, KeyError):
        return False


def game_record(game):
    return str(game.get("state")), tuple(
        (str(team.get("id")), str(team.get("score"))) for team in game.get("teams", [])
    )


def compare(local, public, now=None):
    """Return all deployment inconsistencies. Pure logic; covered by fixture tests."""
    now = now or datetime.now(timezone.utc)
    day = now.astimezone(EASTERN).date()
    local_games = local.get("games", [])
    public_games = public.get("games", [])
    if not isinstance(local_games, list) or not local_games:
        return ["Local feed has no games"]
    if not isinstance(public_games, list):
        return ["Public feed has no games array"]
    try:
        local_stamp, public_stamp = when(local["scores_updated_at"]), when(public["scores_updated_at"])
    except (KeyError, TypeError, ValueError) as exc:
        return ["Missing/invalid scores_updated_at: " + str(exc)]
    errors = []
    if public_stamp < local_stamp:
        errors.append("Public scores_updated_at is older than staged feed")
    today = {str(g["id"]): game_record(g) for g in local_games
             if on_date(g, day) and g.get("state") in ("pre", "in", "post")}
    active_final = {key: value for key, value in today.items() if value[0] in ("in", "post")}
    expected = active_final or today
    # An off-day is not an error. Compare the published full feed instead.
    all_dates = not bool(expected)
    if all_dates:
        expected = {str(g["id"]): game_record(g) for g in local_games
                    if g.get("state") in ("pre", "in", "post")}
    if not expected:
        return errors + ["No recognized source game records"]
    actual = {str(g["id"]): game_record(g) for g in public_games
              if all_dates or on_date(g, day)}
    for eid, (phase, teams) in expected.items():
        new = actual.get(eid)
        if new is None:
            errors.append(eid + ": missing from public feed")
            continue
        if len(new[1]) != len(teams) or tuple(x[0] for x in new[1]) != tuple(x[0] for x in teams):
            errors.append(eid + ": team identity/order mismatch")
            continue
        if phase == "post" and (new[0] != "post" or new[1] != teams):
            errors.append(eid + ": final score/status is stale")
        elif phase == "in":
            if new[0] == "pre":
                errors.append(eid + ": live game still pregame on public feed")
            elif new[0] in ("in", "post"):
                try:
                    if any(int(a[1]) < int(b[1]) for a, b in zip(new[1], teams)):
                        errors.append(eid + ": live score moved backwards")
                except ValueError:
                    errors.append(eid + ": malformed score")
            else:
                errors.append(eid + ": unrecognized public state")
        elif phase == "pre" and new[0] not in ("pre", "in", "post"):
            errors.append(eid + ": invalid pregame status")
    return errors


def main():
    local = json.loads(Path("data/mbb-live.json").read_text(encoding="utf-8"))
    page = os.environ["PAGE_URL"].rstrip("/") + "/data/mbb-live.json"
    last_errors = ["Public site not yet queried"]
    for attempt in range(1, 11):
        try:
            req = urllib.request.Request(
                page + "?verify_mbb=" + str(time.time_ns()),
                headers={"Cache-Control": "no-cache", "Pragma": "no-cache"},
            )
            with urllib.request.urlopen(req, timeout=25) as response:
                public = json.load(response)
            last_errors = compare(local, public)
            if not last_errors:
                print("PASS: public MBB score feed is at least as current as the staged source")
                return
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            last_errors = [type(exc).__name__ + ": " + str(exc)]
        print("MBB public verification attempt", attempt, "/", 10, ":",
              "; ".join(last_errors[:12]), flush=True)
        if attempt < 10:
            time.sleep(7)
    raise SystemExit("Public MBB score publication failed: " + "; ".join(last_errors[:20]))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("MBB Pages score verification error:", repr(exc), file=sys.stderr)
        raise

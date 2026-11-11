#!/usr/bin/env python3
"""Fail closed when a finalized 2026-27 NCAA D-I game does not reach both
RETRO and individual school calendars. Zero writes, no changes to Elo.
"""
import argparse
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

DATA = Path(__file__).resolve().parents[1] / "data"
ET = ZoneInfo("America/New_York")
BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/"

def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))

def score(x):
    try:
        n = x.get("score")
        if isinstance(n, dict):
            n = n.get("value", n.get("displayValue"))
        return int(n)
    except (TypeError, ValueError, AttributeError):
        return None

def source_finals(gender, known):
    sport = "mens-college-basketball" if gender == "men" else "womens-college-basketball"
    days = [datetime.now(ET).date() - timedelta(days=n) for n in (0, 1)]
    pending, failures = [], []
    for day in days:
        by_id = {}
        for options in ("limit=1000", "groups=50&limit=1000"):
            url = BASE + sport + "/scoreboard?" + options + "&dates=" + day.strftime("%Y%m%d")
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "SportingLifeTimes/1.0"})
                with urllib.request.urlopen(req, timeout=18) as res:
                    payload = json.load(res)
                if not isinstance(payload.get("events"), list):
                    raise ValueError("missing events list")
                for event in payload["events"]:
                    if event.get("id"):
                        by_id[str(event["id"])] = event
            except (OSError, ValueError, TypeError) as e:
                failures.append({"day": str(day), "feed": options, "error": str(e)[:110]})
        if not by_id:
            # Legitimately blank dates can exist; if both feeds fail, fail rather than assert fresh.
            if sum(x["day"] == str(day) for x in failures) == 2:
                raise RuntimeError("Both scoreboard sources failed on " + str(day))
        for ev in by_id.values():
            if ev.get("status", {}).get("type", {}).get("completed") is not True:
                continue
            if ev.get("season", {}).get("year") not in (None, 2027):
                continue
            try:
                tip = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
                # A completed scoreboard game is immediately eligible for verification.
                # Scheduled tipoff age is not a finalization timestamp.
            except (ValueError, KeyError, TypeError):
                continue
            sides = ev.get("competitions", [{}])[0].get("competitors", [])
            home = next((t for t in sides if t.get("homeAway") == "home"), None)
            away = next((t for t in sides if t.get("homeAway") == "away"), None)
            if not home or not away:
                continue
            h, a = str(home.get("team", {}).get("id")), str(away.get("team", {}).get("id"))
            hs, ass = score(home), score(away)
            if h in known and a in known and h != a and hs is not None and ass is not None and hs != ass:
                pending.append({"id": str(ev["id"]), "home": h, "away": a,
                                "home_score": hs, "away_score": ass})
    return pending, failures

def men():
    retro = load("ncaam-2026-27-retro-primary.json")
    overall = load("mbb-overall-records-2026-27.json")
    cross = load("ncaam-2026-27-espn-team-crosswalk.json")
    by_espn = {str(t["espn_id"]): str(t["id"]) for t in cross["teams"] if t.get("espn_id")}
    by_ncaa = {v: k for k, v in by_espn.items()}
    assert retro.get("starting_elo") == 1500 and len(retro.get("rankings", [])) == 365
    assert retro["games_played"] == len(retro["events"])
    assert overall["retro_as_of"] == retro["as_of"]
    fixtures = {}
    calendars = {}
    errors = []
    for g in retro["events"]:
        key = tuple(sorted((str(g["home_id"]), str(g["away_id"])))) + (str(g["date"])[:10],)
        fixtures[key] = g
        for school in (str(g["home_id"]), str(g["away_id"])):
            espn = by_ncaa.get(school)
            if not espn:
                errors.append("RETRO team not in crosswalk " + school)
                continue
            if espn not in calendars:
                calendars[espn] = load("mbb-schedules-2026-27/" + espn + ".json")
            want = {"home": int(g["home_score"]), "away": int(g["away_score"])}
            actual = None
            for e in calendars[espn].get("events", []):
                sides = e.get("competitions", [{}])[0].get("competitors", [])
                if {str(s.get("team", {}).get("id")) for s in sides} != {
                        by_ncaa[str(g["home_id"])], by_ncaa[str(g["away_id"])]}:
                    continue
                try:
                    day = datetime.fromisoformat(str(e["date"]).replace("Z", "+00:00")).date()
                    delta = abs((day - datetime.fromisoformat(str(g["date"])[:10]).date()).days)
                except (ValueError, TypeError, KeyError):
                    continue
                if delta > 1:
                    continue
                h = next((s for s in sides if str(s["team"]["id"]) == by_ncaa[str(g["home_id"])]), {})
                a = next((s for s in sides if str(s["team"]["id"]) == by_ncaa[str(g["away_id"])]), {})
                if (score(h) == want["home"] and score(a) == want["away"] and
                        e.get("status", {}).get("type", {}).get("completed") is True):
                    actual = e
                    break
            if actual is None:
                errors.append("Men's schedule omits final " + str(g["id"]) + " for " + espn)
    recent, warnings = source_finals("men", by_espn)
    for f in recent:
        home, away = by_espn[f["home"]], by_espn[f["away"]]
        eligible = [g for g in retro["events"] if
                    {g["home_id"], g["away_id"]} == {home, away} and
                    int(g["home_score"] if g["home_id"] == home else g["away_score"]) == f["home_score"] and
                    int(g["away_score"] if g["away_id"] == away else g["home_score"]) == f["away_score"]]
        if not eligible:
            errors.append("Men's RETRO missing completed scoreboard event " + f["id"])
    return errors, {"verified_retro_finals": retro["games_played"],
                    "recent_source_final_count": len(recent), "partial_source_warnings": warnings}

def women():
    retro = load("ncaaw-2026-27-retro-primary.json")
    verified = load("ncaaw-2026-27-verified-games.json")
    schedules = load("ncaaw-schedules-2026-27.json")["teams"]
    quarantine = load("wbb-final-calendar-reconciliation-audit.json").get("quarantined_schedule_conflicts", [])
    quarantined = {(str(c["game_id"]), str(c["team_id"])) for c in quarantine}
    errors = []
    assert retro.get("gender") == "women" and retro["starting_elo"] == 1500
    assert len(retro.get("rankings", [])) == 363 and retro["games_played"] == len(retro["events"])
    ids = {str(g["id"]) for g in retro["events"]}
    for g in verified["games"]:
        if g.get("status") != "final" or g["home_id"] == g["away_id"]:
            continue
        home, away = str(g["home_id"]), str(g["away_id"])
        if home not in schedules or away not in schedules:
            continue
        if str(g["id"]) not in ids:
            errors.append("Women's RETRO missing verified event " + str(g["id"]))
        for school in (home, away):
            if (str(g["id"]), school) in quarantined:
                continue
            candidates = [e for e in schedules[school]["games"] if str(e.get("id")) == str(g["id"])]
            if not any(e.get("completed") is True and
                       {str(e.get("home_id")), str(e.get("away_id"))} == {home, away} and
                       int(e.get("home_score") or 0) ==
                       int(g["home_score"] if str(e.get("home_id")) == home else g["away_score"]) and
                       int(e.get("away_score") or 0) ==
                       int(g["away_score"] if str(e.get("away_id")) == away else g["home_score"])
                       for e in candidates):
                errors.append("Women's schedule omits verified final " + str(g["id"]) + " for " + school)
    recent, warnings = source_finals("women", set(schedules))
    for f in recent:
        if f["id"] not in ids:
            errors.append("Women's RETRO missing completed scoreboard event " + f["id"])
    return errors, {"verified_retro_finals": retro["games_played"],
                    "quarantined_identity_conflicts": len(quarantined),
                    "recent_source_final_count": len(recent), "partial_source_warnings": warnings}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--gender", choices=("men", "women"), required=True)
    args = p.parse_args()
    errors, stats = men() if args.gender == "men" else women()
    print(json.dumps({"gender": args.gender, **stats, "stale_or_missing": errors[:40]}, indent=2))
    if errors:
        raise SystemExit("CBB pipeline incomplete: " + str(len(errors)) + " missing or conflicting updates")

if __name__ == "__main__":
    main()

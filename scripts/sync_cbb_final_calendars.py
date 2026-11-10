#!/usr/bin/env python3
"""Copy ONLY verified 2026-27 D-I finals into the two independent team calendars.

Never use a schedule to create a RETRO result. Preserve school-provided fixtures,
venues, broadcast details, tipoffs, and non-D-I results. Re-running is idempotent.
"""
import argparse
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_if_changed(path, obj, check=False):
    contents = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    if path.read_text(encoding="utf-8") == contents:
        return False
    if not check:
        path.write_text(contents, encoding="utf-8")
    return True


def score_valid(game):
    a, h = game.get("away_score"), game.get("home_score")
    return (isinstance(a, int) and not isinstance(a, bool) and
            isinstance(h, int) and not isinstance(h, bool) and
            a > 0 and h > 0 and a != h)


def day_delta(a, b):
    try:
        return abs((date.fromisoformat(str(a)[:10]) -
                    date.fromisoformat(str(b)[:10])).days)
    except ValueError:
        return 999


def men(check=False):
    ratings = read(DATA / "ncaam-2026-27-retro-primary.json")
    cross = read(DATA / "ncaam-2026-27-espn-team-crosswalk.json")
    if ratings.get("season") != "2026-27" or ratings.get("starting_elo") != 1500 or len(ratings.get("rankings", [])) != 365:
        raise ValueError("Refusing incomplete men's RETRO snapshot")
    pairs = {str(x["id"]): x for x in cross["teams"] if x.get("espn_id")}
    by_team = defaultdict(list)
    for final in ratings.get("events", []):
        if not score_valid(final) or not str(final.get("id", "")).startswith("espn:"):
            continue
        away, home = pairs.get(str(final.get("away_id"))), pairs.get(str(final.get("home_id")))
        if not away or not home or day_delta(final.get("date"), "2026-11-01") > 180:
            continue
        for team, opponent in ((away, home), (home, away)):
            by_team[str(team["espn_id"])].append((final, team, opponent))
    changed_files = appended = updated = conflicts = 0
    for team_id, fixtures in by_team.items():
        path = DATA / "mbb-schedules-2026-27" / (team_id + ".json")
        if not path.exists():
            raise ValueError("Missing men's calendar for ESPN team " + team_id)
        doc = read(path)
        if doc.get("season") != "2026-27" or str(doc.get("espn_team_id")) != team_id:
            raise ValueError("Men's schedule identity mismatch " + team_id)
        events = doc.get("events")
        if not isinstance(events, list):
            raise ValueError("Men's schedule is not an event list " + team_id)
        dirty = False
        for final, team, opponent in fixtures:
            event_id = str(final["id"]).removeprefix("espn:")
            other_id = str(opponent["espn_id"])
            matches = []
            for event in events:
                sides = (event.get("competitions") or [{}])[0].get("competitors", [])
                ids = {str(side.get("team", {}).get("id")) for side in sides}
                if ids != {team_id, other_id}:
                    continue
                if str(event.get("id", "")).removeprefix("espn:") == event_id or day_delta(event.get("date"), final.get("date")) <= 1:
                    matches.append(event)
            if len(matches) > 1:
                conflicts += 1
                continue
            if matches:
                event = matches[0]
                sides = event["competitions"][0]["competitors"]
                for side in sides:
                    want = int(final["home_score"] if str(side["team"]["id"]) == str(pairs[str(final["home_id"])]["espn_id"]) else final["away_score"])
                    old = side.get("score")
                    if event.get("status", {}).get("type", {}).get("completed") and old is not None and str(old).isdigit() and int(old) != want:
                        raise ValueError("Conflicting already final school score for " + event_id)
                    if old != want:
                        side["score"] = want
                        dirty = True
                if event.get("status", {}).get("type", {}).get("completed") is not True:
                    event["status"] = {"type": {"state": "post", "completed": True}}
                    dirty = True
                if not event.get("retro_verified_final"):
                    event["retro_verified_final"] = final["id"]
                    dirty = True
                updated += 1
            else:
                home = pairs[str(final["home_id"])]
                away = pairs[str(final["away_id"])]
                # Noon ET is a DATE-ONLY storage sentinel, NEVER a published tipoff.
                event = {
                    "id": event_id, "date": final["date"] + "T12:00:00-05:00",
                    "date_time_placeholder": True,
                    "name": away["espn_name"] + " at " + home["espn_name"],
                    "neutralSite": bool(final.get("neutral")),
                    "site_verified": bool(final.get("site_verified")),
                    "retro_verified_final": final["id"],
                    "status": {"type": {"state": "post", "completed": True}},
                    "competitions": [{"competitors": [
                        {"homeAway": "home", "team": {"id": str(home["espn_id"]), "displayName": home["espn_name"]}, "score": final["home_score"]},
                        {"homeAway": "away", "team": {"id": str(away["espn_id"]), "displayName": away["espn_name"]}, "score": final["away_score"]},
                    ]}],
                }
                events.append(event)
                appended += 1
                dirty = True
        if dirty:
            events.sort(key=lambda x: str(x.get("date", "")))
            if write_if_changed(path, doc, check):
                changed_files += 1
    return {"men_files": changed_files, "men_added": appended,
            "men_matched": updated, "men_ambiguous": conflicts}


def women(check=False):
    ratings = read(DATA / "ncaaw-2026-27-retro-primary.json")
    finals = read(DATA / "ncaaw-2026-27-verified-games.json")
    teams = read(DATA / "ncaaw-2026-27-teams.json")
    path = DATA / "ncaaw-schedules-2026-27.json"
    doc = read(path)
    if (ratings.get("gender") != "women" or ratings.get("starting_elo") != 1500 or
        len(ratings.get("rankings", [])) != 363 or doc.get("gender") != "women" or
        finals.get("season") != "2026-27"):
        raise ValueError("Refusing incomplete women-only final or schedule sources")
    names = {str(t["team_id"]): t["team"] for t in teams["teams"]}
    changed = added = updated = 0
    conflicts = []
    for g in finals.get("games", []):
        if g.get("status") != "final" or not score_valid(g):
            continue
        home, away = str(g.get("home_id")), str(g.get("away_id"))
        if home not in names or away not in names or home == away:
            continue  # Keep D-I-only RETRO separate from non-D-I games.
        for team_id, opponent_id, site in ((home, away, "home"), (away, home, "away")):
            schedule = doc.get("teams", {}).get(team_id)
            if schedule is None:
                raise ValueError("Missing women team calendar " + team_id)
            games = schedule["games"]
            found = [e for e in games if str(e.get("id")) == str(g["id"])]
            if len(found) > 1:
                raise ValueError("Duplicate women's schedule event " + str(g["id"]))
            if found:
                event = found[0]
                same = str(event.get("home_id")) == home and str(event.get("away_id")) == away
                flipped = (str(event.get("home_id")) == away and
                           str(event.get("away_id")) == home and
                           g.get("status") == "final")
                if (not (same or flipped) or
                    str(event.get("opponent_id")) != opponent_id or
                    day_delta(event.get("date"), g.get("date")) > 2):
                    raise ValueError("Women's calendar identity conflict " + str(g["id"]))
                # A neutral-site school's home/away listing may be reversed
                # relative to the scoreboard. Scores follow team identities.
                oriented_home = g["away_score"] if flipped else g["home_score"]
                oriented_away = g["home_score"] if flipped else g["away_score"]
                if event.get("completed") and (event.get("home_score") not in (None, oriented_home) or
                                             event.get("away_score") not in (None, oriented_away)):
                    raise ValueError("Conflicting women's published final " + str(g["id"]))
                for k, val in (("completed", True), ("home_score", oriented_home),
                               ("away_score", oriented_away)):
                    if event.get(k) != val:
                        event[k] = val
                        changed += 1
                if flipped and event.get("site") != "neutral":
                    event["result_site_conflict"] = True
                    changed += 1
                updated += 1
            else:
                games.append({
                    "id": str(g["id"]), "date": g["date"],
                    "opponent_id": opponent_id, "opponent": names[opponent_id],
                    "home_id": home, "away_id": away,
                    "site": "neutral" if g.get("neutral") else site,
                    "venue": g.get("venue"), "broadcast": g.get("broadcast"),
                    "completed": True, "home_score": g["home_score"],
                    "away_score": g["away_score"],
                    "source": "verified women's final ledger",
                })
                added += 1
                changed += 1
    if changed:
        for team in doc["teams"].values():
            team["games"].sort(key=lambda x: str(x.get("date", "")))
        write_if_changed(path, doc, check)
    audit = {"season": "2026-27", "gender": "women", "verified_final_games": len(finals.get("games", [])),
             "changed_fields_or_games": changed, "quarantined_schedule_conflicts": conflicts}
    audit_path = DATA / "wbb-final-calendar-reconciliation-audit.json"
    contents = json.dumps(audit, ensure_ascii=False, indent=2) + "\n"
    if not check and (not audit_path.exists() or audit_path.read_text(encoding="utf-8") != contents):
        audit_path.write_text(contents, encoding="utf-8")
    if conflicts:
        print("WBB schedule conflicts quarantined:", len(conflicts), conflicts[:10])
    return {"women_modified_fields_or_added": changed, "women_added": added, "women_matched": updated,
            "women_conflicts_quarantined": len(conflicts)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gender", choices=["men", "women", "both"], default="both")
    parser.add_argument("--check", action="store_true", help="Report changes without writing files")
    args = parser.parse_args()
    result = {}
    if args.gender in ("men", "both"):
        result.update(men(args.check))
    if args.gender in ("women", "both"):
        result.update(women(args.check))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()

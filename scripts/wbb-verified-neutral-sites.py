#!/usr/bin/env python3
"""Bind independently cited women-only neutral tournament evidence to exact game IDs."""
import datetime
import json
import pathlib
import re
from zoneinfo import ZoneInfo

DATA = pathlib.Path(__file__).resolve().parents[1] / "data"
SOURCE = DATA / "ncaaw-2026-27-auburn-neutral-site-evidence.json"
CALENDAR = DATA / "ncaaw-schedules-2026-27.json"
OUTPUT = DATA / "ncaaw-2026-27-verified-neutral-sites.json"


def local_date(timestamp):
    return datetime.datetime.fromisoformat(str(timestamp).replace("Z", "+00:00")).astimezone(
        ZoneInfo("America/New_York")).date().isoformat()


def resolve(calendar, evidence):
    if calendar.get("season") != "2026-27" or calendar.get("gender") != "women":
        raise RuntimeError("Refusing a non-women's or wrong-season calendar")
    if len(calendar.get("teams", {})) != 363:
        raise RuntimeError("Full 363-school women's registry required")
    if evidence.get("season") != "2026-27" or evidence.get("gender") != "women":
        raise RuntimeError("Wrong sports evidence")
    records = evidence.get("records")
    if not isinstance(records, list) or not records:
        raise RuntimeError("No independently sourced tournament evidence")
    assigned = {}
    for claim in records:
        team_id, opponent_id = str(claim.get("team_id", "")), str(claim.get("opponent_id", ""))
        if not re.fullmatch(r"\d+", team_id) or not re.fullmatch(r"\d+", opponent_id):
            raise RuntimeError("School and opponent IDs must be numeric")
        if team_id == opponent_id or claim.get("site") != "neutral":
            raise RuntimeError("Evidence must identify two different women's teams and neutral site")
        if not all(str(claim.get(x, "")).startswith("https://") for x in ("primary_source", "corroborating_source")):
            raise RuntimeError("Two independent HTTPS source URLs required")
        if not claim.get("venue") or not re.fullmatch(r"202[67]-\d\d-\d\d",str(claim.get("date",""))):
            raise RuntimeError("Missing cited venue or game date")
        club = calendar["teams"].get(team_id)
        if not club or opponent_id not in calendar["teams"]:
            raise RuntimeError("Neutral evidence has unknown Division I women's team ID")
        matches = [g for g in club.get("games", []) if str(g.get("opponent_id")) == opponent_id
                   and local_date(g.get("date")) == claim["date"]]
        if len(matches) != 1:
            raise RuntimeError("Ambiguous/missing WBB neutral fixture: "+team_id+" "+opponent_id+" "+claim["date"])
        game = matches[0]
        gid = str(game.get("id", ""))
        if not re.fullmatch(r"\d+", gid) or gid in assigned:
            raise RuntimeError("Neutral-source fixture duplicates or lacks stable game ID")
        if {str(game.get("home_id")), str(game.get("away_id"))} != {team_id, opponent_id}:
            raise RuntimeError("Source neutral fixture game identities do not match school records")
        # Accept both a correct neutral ESPN classification and a discrepant
        # home/away classification. The two-source neutral fact is separate;
        # never overwrite the immutable ESPN record or its IDs here.
        assigned[gid] = {
            "game_id": gid,"date":claim["date"],"team_id":team_id,
            "opponent_id":opponent_id,"published_site":game.get("site"),
            "verified_site":"neutral","verified_venue":claim["venue"],
            "source_url":claim["primary_source"],
            "corroborating_source_url":claim["corroborating_source"],
            "evidence_kind":"women_university_and_opponent_or_organizer",
        }
    return {"season":"2026-27","gender":"women","source_scope":"two_source_neutral_site_verification",
            "policy":"Exact ESPN event ID, both Division I team IDs and Eastern game date. Neutral-site venue independently verified; no master schedule or result rewritten.",
            "verified_unique_games":len(assigned),
            "games":[assigned[k] for k in sorted(assigned)]}


def main():
    result = resolve(json.loads(CALENDAR.read_text()),json.loads(SOURCE.read_text()))
    serialized = json.dumps(result,ensure_ascii=False,indent=2)+"\n"
    if not OUTPUT.exists() or OUTPUT.read_text() != serialized:
        OUTPUT.write_text(serialized)
    print("WBB 2026-27 source corroborated neutral venues:",result["verified_unique_games"])


if __name__ == "__main__":
    main()

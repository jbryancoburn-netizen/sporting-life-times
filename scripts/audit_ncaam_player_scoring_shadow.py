#!/usr/bin/env python3
"""Reproduce the NCAA preseason player-scoring shadow; never modify primary Elo."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"

def build(movement, crosswalk, ratings):
    players = {}
    for school in movement["teams"]:
        for p in school["players"]:
            key = str(p["current_id"])
            if key in players:
                raise ValueError("Duplicate player ID: " + key)
            players[key] = (school["team_id"], p)
    if len(players) != movement["players_audited"]:
        raise ValueError("Roster count mismatch")
    excluded = dict(fuzzy=0, prior_school_mismatch=0, missing_prior_minutes=0, missing_prior_points=0)
    totals = {}
    seen = set()
    matched = 0
    for link in crosswalk["links"]:
        pid = str(link["id"])
        if pid in seen or pid not in players:
            raise ValueError("Duplicate or unknown crosswalk ID: " + pid)
        seen.add(pid)
        team, p = players[pid]
        if link["method"] == "jaro_winkler":
            excluded["fuzzy"] += 1
            continue
        if link["method"] not in ("name_jersey", "name", "last_jersey"):
            raise ValueError("Unapproved matching method")
        if p.get("prior_school_id") != link.get("prior"):
            excluded["prior_school_mismatch"] += 1
            continue
        minutes = p.get("prior_minutes")
        points = p.get("prior_points")
        if not isinstance(minutes, (int, float)) or not 0 < minutes < 10000:
            excluded["missing_prior_minutes"] += 1
            continue
        if not isinstance(points, (int, float)) or not 0 <= points < 10000:
            excluded["missing_prior_points"] += 1
            continue
        segment = "returning" if team == link["prior"] else "incoming"
        t = totals.setdefault(team, {"players": 0, "returning_points": 0, "incoming_points": 0, "returning_minutes": 0, "incoming_minutes": 0})
        t["players"] += 1
        t[segment + "_points"] += points
        t[segment + "_minutes"] += minutes
        matched += 1
    if len(seen) != crosswalk["linked_count"]:
        raise ValueError("Crosswalk link count mismatch")
    teams = []
    for r in ratings["rankings"]:
        t = totals.get(r["team_id"], {})
        row = dict(team_id=r["team_id"], team=r["team"], rank=r["rank"], elo=r["elo"],
                   verified_players=t.get("players", 0))
        for segment in ("returning", "incoming"):
            minutes = t.get(segment + "_minutes", 0)
            points = t.get(segment + "_points", 0)
            row[segment + "_prior_points"] = round(points, 2)
            row[segment + "_prior_minutes"] = round(minutes, 2)
            row[segment + "_points_per_minute"] = round(points / minutes, 5) if minutes else None
        teams.append(row)
    if len(teams) != 365 or len({x["team_id"] for x in teams}) != 365:
        raise ValueError("Incomplete team universe")
    return {"season": "2026-27", "status": "shadow-player-scoring-evidence-not-calibrated",
            "source": "2025-26 NCAA points/minutes from movement audit, pinned ESPN-NCAA crosswalk",
            "method": "Use non-fuzzy crosswalk IDs with corroborated historical school, valid positive prior minutes and nonnegative prior points. Unlinked/new entrants are not imputed. Scoring contributions are diagnostics only, not Elo adjustments.",
            "source_counts": {"roster_players": len(players), "crosswalk_links": len(seen),
                "matched_scoring_records": matched, "excluded": excluded,
                "unlinked_roster_players": crosswalk["unlinked_count"],
                "strong_links": crosswalk["strong_count"]},
            "warning": "Prior points per minute is a scoring-rate proxy, not efficiency adjusted for usage, opponents or team context; no chronological validation is supplied. Do not change official rankings based on this report.",
            "teams": teams}

def main():
    paths = ["ncaam-2026-27-player-movement-audit.json",
             "ncaam-2026-27-direct-player-crosswalk.json",
             "ncaam-2026-27-preseason-roster-informed.json"]
    inputs = [json.loads((ROOT / p).read_text()) for p in paths]
    actual = build(*inputs)
    published = json.loads((ROOT / "ncaam-2026-27-player-scoring-shadow.json").read_text())
    if actual != published:
        raise SystemExit("FAIL: published scoring evidence does not reproduce")
    print("PASS:", actual["source_counts"]["matched_scoring_records"], "players,",
          len(actual["teams"]), "teams")
if __name__ == "__main__":
    main()

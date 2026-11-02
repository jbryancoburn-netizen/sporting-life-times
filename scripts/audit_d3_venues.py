#!/usr/bin/env python3
"""Audit both DIII fixture editions without guessing arenas or identities."""
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/d3-school-venue-exceptions-2026-27.json"


def audit(gender):
    schedule = json.loads((ROOT / f"data/d3-{gender}-official-fixtures-2026-27.json").read_text())
    directory = json.loads((ROOT / f"data/d3-{gender}-2026-27.json").read_text())
    teams = {t["ncaa_org_id"]: t for t in directory["teams"] if t.get("d3_confirmed")}
    missing = defaultdict(lambda: {"missing_home_arenas": 0, "missing_game_locations": 0,
                                  "missing_tipoffs": 0, "conflict_count": 0,
                                  "venue_example_ids": [], "official_sources": set()})
    seen = set()
    for f in schedule["fixtures"]:
        key = (f["date"], tuple(sorted((f["home_org_id"], f["away_org_id"]))))
        if key in seen:
            raise AssertionError((gender, "duplicate date + opponent pair", key))
        seen.add(key)
        home = f["home_org_id"]
        if home not in teams:
            raise AssertionError((gender, "unknown home program", home))
        row = missing[home]
        if not f.get("venue"):
            row["missing_home_arenas"] += 1
            if len(row["venue_example_ids"]) < 12:
                row["venue_example_ids"].append(f["id"])
        if not f.get("venue_location"):
            row["missing_game_locations"] += 1
        if not f.get("tipoff_as_posted"):
            row["missing_tipoffs"] += 1
        row["official_sources"].update(f.get("official_schedule_sources", []))
    for c in schedule.get("conflicts", []):
        for member in c.get("members", []):
            if member in teams:
                missing[member]["conflict_count"] += 1
                missing[member]["official_sources"].update(c.get("source_urls", []))
    records = []
    for org, team in teams.items():
        x = missing[org]
        records.append({"ncaa_org_id": org, "school": team["name"], "gender": gender,
                        "state": team.get("state", ""), "athletics_site": team.get("athletics_site", ""),
                        "missing_home_arenas": x["missing_home_arenas"],
                        "missing_game_locations": x["missing_game_locations"],
                        "missing_tipoffs": x["missing_tipoffs"],
                        "site_conflict_exposures": x["conflict_count"],
                        "venue_example_ids": x["venue_example_ids"],
                        "official_sources": sorted(x["official_sources"])[:12],
                        "logo_url_present": bool(team.get("logo_url")),
                        "official_logo_slug_present": bool(team.get("slug")),
                        "verified_two_school_colors": bool(team.get("primary") and team.get("secondary")
                                                           and team.get("color_source"))})
    records.sort(key=lambda x: (-x["missing_home_arenas"], -x["missing_game_locations"],
                                -x["site_conflict_exposures"], x["school"]))
    return {"gender": gender, "program_count": len(records), "fixture_count": len(seen),
            "missing_arena_fields": sum(not f.get("venue") for f in schedule["fixtures"]),
            "missing_location_fields": sum(not f.get("venue_location") for f in schedule["fixtures"]),
            "missing_tipoff_fields": sum(not f.get("tipoff_as_posted") for f in schedule["fixtures"]),
            "source_conflict_count": len(schedule.get("conflicts", [])),
            "programs": records}


def main():
    men, women = audit("men"), audit("women")
    result = {"season": "2026-27", "scope": "source-backed exception queue; not proof of missing games",
              "men": men, "women": women}
    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print("DIII venue/source exceptions:",
          [(g, result[g]["fixture_count"], result[g]["missing_arena_fields"])
           for g in ("men", "women")])


if __name__ == "__main__":
    main()

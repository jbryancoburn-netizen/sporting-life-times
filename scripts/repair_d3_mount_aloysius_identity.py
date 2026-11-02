#!/usr/bin/env python3
"""Apply exactly two first-party Mount Aloysius NCAA-identity corrections in place.

No network, new workflow, scores, Elo, or fabricated games. Refuses unknown ledgers.
Used only if the normal corrected source importer has not already added the games.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data/d3-men-official-fixtures-2026-27.json"
SOURCE = "https://www.mountieathletics.com/sports/mens-basketball/schedule/2026-27?grid=true"
TARGETS = (("2027-02-06", 1315, "Pitt-Bradford * *", "2:00 PM"),
           ("2027-02-10", 538, "Penn State Behrend * *", "7:00 PM"))


def run(write=False):
    d = json.loads(PATH.read_text())
    if any((d.get("division") != "d3", d.get("gender") != "men",
            d.get("season") != "2026-27",
            d.get("fixture_count") != len(d.get("fixtures", [])))):
        raise ValueError("Unexpected DIII men's ledger metadata/count")
    converted = []
    for date, away_id, label, tipoff in TARGETS:
        game_id = f"d3-men-{date}-{away_id}-30036"
        pair = {away_id, 30036}
        existing = [g for g in d["fixtures"] if
                    g.get("date") == date and
                    {g.get("away_org_id"), g.get("home_org_id")} == pair]
        source_rows = [r for r in d["unresolved_opponent_fixtures"] if
                       r.get("date") == date and
                       r.get("source_owner_org_id") == 30036 and
                       r.get("external_opponent_label") == label and
                       r.get("placement") == "home" and
                       r.get("tipoff_as_posted") == tipoff and
                       r.get("source_url") == SOURCE]
        if existing:
            if len(existing) != 1 or existing[0].get("id") != game_id or (
                    existing[0].get("home_org_id") != 30036):
                raise ValueError(f"Existing conflicting fixture for {date}")
            if source_rows:
                raise ValueError(f"Mixed real/external identity for {date}")
            continue
        if len(source_rows) != 1:
            raise ValueError(f"Missing uniquely identified university source row {date}")
        row = source_rows[0]
        d["unresolved_opponent_fixtures"].remove(row)
        d["fixtures"].append({
            "id": game_id, "date": date, "away_org_id": away_id,
            "home_org_id": 30036, "neutral": False, "status": "scheduled",
            "source_url": SOURCE, "official_schedule_sources": [SOURCE],
            "verified_by_org_ids": [30036], "source_kind": "official_school",
            "source_verification": "single_official_school",
            "tipoff_as_posted": tipoff,
            "venue": "Athletic, Convocation, and Wellness Center",
            "venue_location": "Cresson, Pa.", "network_as_posted": "",
            "radio_as_posted": "", "tournament": "",
            "neutral_home_designation_unconfirmed": False
        })
        converted.append(game_id)
    d["fixtures"].sort(key=lambda x: (x["date"], x["id"]))
    d["fixture_count"] = len(d["fixtures"])
    d["unresolved_opponent_fixture_count"] = len(d["unresolved_opponent_fixtures"])
    if d["fixture_count"] not in (4298, 4299, 4300):
        raise ValueError("Unexpected fixture count; check fresh ledger before applying")
    if write and converted:
        PATH.write_text(json.dumps(d, indent=2) + "\n")
    print(json.dumps({"write": write, "promoted": converted,
                      "fixture_count": d["fixture_count"],
                      "remaining_external_opponent_rows":
                          d["unresolved_opponent_fixture_count"]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    run(args.write)

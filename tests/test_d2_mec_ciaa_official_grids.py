"""2026–27 men MEC/CIAA official single-university calendar recovery guards.

Source rows document the named university calendars; they are not a claim
that each DII-v-DII game is uniquely published or that official times never
change. Exclude unidentified tournament pairings and non-DII opponents.
"""
import datetime as dt
import json
import unittest
from pathlib import Path

from scripts.build_d2_basketball import apply_official_school_grid_snapshots


REGISTRY = Path(__file__).resolve().parents[1] / "data" / "d2-official-school-grids-2026-27.json"
EXPECTED = {
    "west-liberty": 30,
    "fairmont-state": 28,
    "west-virginia-wesleyan": 26,
    "livingstone": 24,
}
ALIASES = {
    "West Liberty University": "west-liberty",
    "West Liberty": "west-liberty",
    "Fairmont State University": "fairmont-state",
    "Fairmont State": "fairmont-state",
    "West Virginia Wesleyan College": "west-virginia-wesleyan",
    "West Virginia Wesleyan": "west-virginia-wesleyan",
    "Livingstone College": "livingstone",
}


def school_data():
    schools = json.loads(REGISTRY.read_text(encoding="utf-8"))["schools"]
    return {
        x["owner_id"]: x for x in schools
        if x["gender"] == "men" and x["owner_id"] in EXPECTED
    }


class D2MecCiaaSchoolGrids(unittest.TestCase):
    def test_all_four_calendars_and_rows_are_supported(self):
        schools = school_data()
        self.assertEqual(set(schools), set(EXPECTED))
        self.assertEqual(sum(len(s["fixtures"]) for s in schools.values()), 108)
        for school_id, count in EXPECTED.items():
            source = schools[school_id]
            self.assertEqual(len(source["fixtures"]), count)
            self.assertIn("schedule", source["source_url"])
            self.assertTrue(source["source_url"].startswith("https://"))
            unique = {(r["date"], r["opponent"]) for r in source["fixtures"]}
            self.assertEqual(len(unique), count)
            self.assertTrue(all(
                r["role"] in {"home", "away", "neutral"}
                and "score" not in r and "result" not in r
                for r in source["fixtures"]
            ))

    def test_reciprocal_two_school_dates_and_home_roles_match(self):
        schools = school_data()
        for owner, source in schools.items():
            for row in source["fixtures"]:
                other = ALIASES.get(row["opponent"])
                if other not in schools:
                    continue
                matching = [
                    r for r in schools[other]["fixtures"]
                    if r["date"] == row["date"] and ALIASES.get(r["opponent"]) == owner
                ]
                self.assertEqual(len(matching), 1, (owner, row["date"], other))
                reciprocal = matching[0]
                if row["role"] != "neutral":
                    self.assertEqual(
                        {row["role"], reciprocal["role"]}, {"home", "away"}
                    )
                if row["start_time"] and reciprocal["start_time"]:
                    self.assertEqual(row["start_time"], reciprocal["start_time"])

    def test_disputed_fairmont_west_liberty_tipoff_is_not_guessed(self):
        schools = school_data()
        wlu = next(r for r in schools["west-liberty"]["fixtures"]
                   if r["date"] == "2027-01-06")
        fairmont = next(r for r in schools["fairmont-state"]["fixtures"]
                        if r["date"] == "2027-01-06")
        self.assertEqual((wlu["role"], fairmont["role"]), ("away", "home"))
        self.assertEqual(wlu["start_time"], "")
        self.assertEqual(fairmont["start_time"], "")
        self.assertIn("January 6", schools["fairmont-state"]["notes"])

    def test_existing_school_grid_importer_deduplicates_verified_pair(self):
        # Both schools report February 6 with reciprocal court roles.
        teams = {
            "west-liberty": {
                "id": "west-liberty", "name": "West Liberty University", "slug": ""
            },
            "fairmont-state": {
                "id": "fairmont-state", "name": "Fairmont State University", "slug": ""
            },
        }
        games = {}
        stats = apply_official_school_grid_snapshots(
            "men", games, teams, dt.date(2026, 11, 1)
        )
        self.assertEqual(stats["source_rows"], 58)
        self.assertEqual(stats["conflicts"], 0)
        matches = [g for g in games.values()
                   if g["date"] in {"2027-01-06", "2027-02-06"}]
        self.assertEqual(len(matches), 2)
        for match in matches:
            self.assertEqual(match["status"], "scheduled")
            self.assertIsNone(match["home_score"])
            self.assertIsNone(match["away_score"])
        again = apply_official_school_grid_snapshots(
            "men", games, teams, dt.date(2026, 11, 1)
        )
        self.assertEqual(again["created"], 0)
        self.assertEqual(len(matches), 2)


if __name__ == "__main__":
    unittest.main()

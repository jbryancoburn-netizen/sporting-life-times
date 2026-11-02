"""Regression tests: independent official calendars may contradict one another."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_d2_basketball import apply_official_school_grid_snapshots


class CrossSchoolDisagreement(unittest.TestCase):
    def setUp(self):
        self.teams = {
            "west-liberty": {"id": "west-liberty", "name": "West Liberty University"},
            "fairmont-state": {"id": "fairmont-state", "name": "Fairmont State University"},
        }

    def run_fixture(self, second_role="away", second_clock="7:30 PM ET", existing=None):
        calendars = [
            {
                "gender": "men",
                "owner_id": "west-liberty",
                "source_url": "https://hilltoppersports.com/sports/mens-basketball/schedule/2026-27",
                "home_venue": "ASRC · West Liberty, WV",
                "fixtures": [{"date": "2027-02-06", "role": "home",
                              "opponent": "Fairmont State University",
                              "start_time": "4:00 PM ET"}],
            },
            {
                "gender": "men",
                "owner_id": "fairmont-state",
                "source_url": "https://fightingfalcons.com/sports/mens-basketball/schedule/2026-27",
                "home_venue": "Joe Retton Arena · Fairmont, WV",
                "fixtures": [{"date": "2027-02-06", "role": second_role,
                              "opponent": "West Liberty University",
                              "start_time": second_clock}],
            },
        ]
        with tempfile.TemporaryDirectory() as folder:
            registry = Path(folder) / "schools.json"
            registry.write_text(json.dumps({
                "schema": 1, "season": "2026-27", "schools": calendars
            }), encoding="utf-8")
            games = dict(existing or {})
            q = apply_official_school_grid_snapshots(
                "men", games, self.teams, dt.date(2026, 11, 1),
                registry_file=registry
            )
        return q, games

    def test_disputed_clocks_never_take_first_school_time(self):
        q, games = self.run_fixture()
        self.assertEqual(q["time_conflicts"], 1)
        self.assertEqual(q["home_away_conflicts"], 0)
        self.assertEqual(q["created"], 1)
        self.assertEqual(len(games), 1)
        game = next(iter(games.values()))
        self.assertEqual((game["home"], game["away"]),
                         ("west-liberty", "fairmont-state"))
        self.assertEqual(game["start_time"], "")
        self.assertIsNone(game["home_score"])

    def test_disputed_home_courts_fail_closed_before_any_insert(self):
        q, games = self.run_fixture(second_role="home")
        self.assertEqual(q["home_away_conflicts"], 1)
        self.assertEqual(q["created"], 0)
        self.assertEqual(len(games), 0)
        self.assertEqual(q["conflicts"], 2)

    def test_matching_reciprocal_times_can_publish(self):
        q, games = self.run_fixture(second_clock="4:00 PM ET")
        self.assertEqual(q["time_conflicts"], 0)
        self.assertEqual(q["home_away_conflicts"], 0)
        self.assertEqual(len(games), 1)
        self.assertEqual(next(iter(games.values()))["start_time"], "4:00 PM ET")

    def test_disputed_school_clocks_do_not_erase_existing_ncaa_final(self):
        prior = {
            "ncaa-final-42": {"id": "ncaa-final-42", "date": "2027-02-06",
                              "away": "fairmont-state", "home": "west-liberty",
                              "status": "final", "away_score": 71,
                              "home_score": 75, "start_time": "3:00 PM ET"}
        }
        q, games = self.run_fixture(existing=prior)
        self.assertEqual(q["created"], 0)
        self.assertEqual(games["ncaa-final-42"]["status"], "final")
        self.assertEqual(games["ncaa-final-42"]["home_score"], 75)
        self.assertEqual(games["ncaa-final-42"]["start_time"], "3:00 PM ET")
        self.assertEqual(games["ncaa-final-42"]["id"], "ncaa-final-42")


if __name__ == "__main__":
    unittest.main()

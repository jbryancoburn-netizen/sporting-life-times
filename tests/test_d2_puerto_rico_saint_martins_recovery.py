"""Saint Martin's and UPR women's 2026–27 evidence: exact source, no fake results."""
import datetime as dt
import json
import unittest
from pathlib import Path
from scripts.build_d2_basketball import apply_official_school_grid_snapshots

REGISTRY = Path(__file__).resolve().parents[1] / "data" / "d2-official-school-grids-2026-27.json"


def read_schools():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))["schools"]


class VerifiedD2GapRecovery(unittest.TestCase):
    def test_saint_martins_exact_local_calendar_snapshot(self):
        s = next(x for x in read_schools() if
                 x["gender"] == "men" and x["owner_id"] == "saint-martin-s")
        self.assertEqual(len(s["fixtures"]), 27)
        self.assertIn("smusaints.com", s["source_url"])
        self.assertEqual(len({(r["date"], r["opponent"])
                              for r in s["fixtures"]}), 27)
        self.assertFalse(any(r["date"] == "2026-12-19"
                             for r in s["fixtures"]), "Disputed Hawaii Pacific crossover held")
        self.assertIn("Dec 19 Hawaii Pacific", s["scope"])
        games = {r["date"] + "/" + r["opponent"]: r for r in s["fixtures"]}
        self.assertEqual(games["2027-02-20/Northwest Nazarene"]["start_time"],
                         "10:30 PM ET")
        self.assertEqual(games["2027-01-21/Northwest Nazarene"]["start_time"],
                         "9:30 PM ET")
        self.assertEqual(games["2026-11-13/Hawaii Hilo"]["start_time"],
                         "10:30 PM ET")
        self.assertEqual(games["2027-02-13/Alaska Fairbanks"]["start_time"],
                         "6:15 PM ET")
        for row in s["fixtures"]:
            self.assertIn(row["role"], {"home", "away", "neutral"})
            self.assertTrue(row["source_clock"].endswith(" PT"))
            self.assertTrue(row["start_time"].endswith(" ET"))
            self.assertFalse(any(k in row for k in
                                 ("status", "home_score", "away_score", "elo_change_home")))

    def test_womens_independent_university_evidence_exact_dates(self):
        schools = {x["owner_id"]: x for x in read_schools() if x["gender"] == "women"}
        expected = {
            "walsh-university": [("2026-11-13", "neutral", "University of Puerto Rico, Mayaguez")],
            "augustana-university-south-dakota": [
                ("2026-11-27", "away", "University of Puerto Rico, Mayaguez"),
                ("2026-11-28", "away", "University of Puerto Rico, Rio Piedras")],
            "mckendree-university": [
                ("2026-12-17", "neutral", "University of Puerto Rico, Mayaguez")],
        }
        for owner, cases in expected.items():
            source = schools[owner]
            self.assertEqual(len(source["fixtures"]), len(cases))
            self.assertTrue(source["source_url"].startswith("https://"))
            self.assertIn("Not a complete".lower(), source["scope"].lower())
            self.assertEqual([(f["date"], f["role"], f["opponent"])
                              for f in source["fixtures"]], cases)
            self.assertTrue(all(f["opponent_identity_source_url"].startswith("https://")
                                for f in source["fixtures"]))
        self.assertEqual(schools["walsh-university"]["fixtures"][0]["start_time"],
                         "2:00 PM ET")
        self.assertEqual(schools["mckendree-university"]["fixtures"][0]["start_time"],
                         "")

    def test_four_womens_fixtures_publish_once_and_preserve_no_finals(self):
        names = {
            "walsh-university": "Walsh University",
            "augustana-university-south-dakota": "Augustana University (South Dakota)",
            "mckendree-university": "McKendree University",
            "university-of-puerto-rico-mayaguez": "University of Puerto Rico, Mayaguez",
            "university-of-puerto-rico-rio-piedras": "University of Puerto Rico, Rio Piedras",
        }
        teams = {id: {"id": id, "name": name} for id, name in names.items()}
        games = {}
        stats = apply_official_school_grid_snapshots(
            "women", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(stats["source_rows"], 4)
        self.assertEqual(stats["created"], 4)
        self.assertEqual(len(games), 4)
        self.assertEqual(
            {g["date"] for g in games.values()},
            {"2026-11-13", "2026-11-27", "2026-11-28", "2026-12-17"})
        for g in games.values():
            self.assertEqual(g["status"], "scheduled")
            self.assertIsNone(g["home_score"])
            self.assertIsNone(g["away_score"])
            self.assertTrue(g["source_url"].startswith("https://"))
        second = apply_official_school_grid_snapshots(
            "women", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(second["created"], 0)
        self.assertEqual(len(games), 4)

    def test_saint_martins_gnac_two_dates_publish_once(self):
        teams = {
            "saint-martin-s": {"id": "saint-martin-s", "name": "Saint Martin's"},
            "northwest-nazarene": {"id": "northwest-nazarene",
                                    "name": "Northwest Nazarene"},
        }
        games = {}
        stats = apply_official_school_grid_snapshots(
            "men", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(stats["source_rows"], 27)
        self.assertEqual(stats["created"], 2)
        self.assertEqual(len(games), 2)
        self.assertEqual({g["start_time"] for g in games.values()},
                         {"9:30 PM ET", "10:30 PM ET"})
        second = apply_official_school_grid_snapshots(
            "men", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(second["created"], 0)
        self.assertEqual(len(games), 2)


if __name__ == "__main__":
    unittest.main()

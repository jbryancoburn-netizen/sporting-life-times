"""Source-backed 2026-27 MSU Moorhead men and Central Washington women school-grid captures."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRID = ROOT / "data" / "d2-official-school-grids-2026-27.json"


class D2SchoolCalendarRecoveryBatch(unittest.TestCase):
    def test_both_29_row_snapshots_preserve_time_provenance(self):
        data = json.loads(GRID.read_text(encoding="utf-8"))
        for gender, owner, zone in [
            ("men", "minnesota-state-university-moorhead", "America/Chicago"),
            ("women", "central-washington-university", "America/Los_Angeles"),
        ]:
            school = [x for x in data["schools"]
                      if x.get("gender") == gender and x.get("owner_id") == owner]
            self.assertEqual(len(school), 1)
            school = school[0]
            self.assertEqual(len(school["fixtures"]), 29)
            self.assertTrue(school["source_url"].startswith("https://"))
            self.assertTrue(school["source_references"])
            keyset = set()
            for row in school["fixtures"]:
                key = (row["date"], row["opponent"])
                self.assertNotIn(key, keyset)
                keyset.add(key)
                self.assertIn(row["role"], ("home", "away", "neutral"))
                self.assertRegex(row["date"], r"^202[67]-\d\d-\d\d$")
                self.assertEqual(row["source_time_zone"], zone)
                self.assertRegex(row["start_time"], r"^(?:[1-9]|1[0-2]):[0-5]\d [AP]M ET$")
                self.assertRegex(row["source_time_as_posted"], r"^(?:[1-9]|1[0-2]):[0-5]\d [AP]M$")
            self.assertFalse(any(a.get("owner_id") == owner
                                 and a.get("gender") == gender
                                 for a in data["certification_assertions"]))

    def test_builder_rejects_unconverted_local_tipoff(self):
        import datetime as dt
        import tempfile
        from scripts.build_d2_basketball import apply_official_school_grid_snapshots
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "school.json"
            school = {
                "gender": "men",
                "owner_id": "alpha",
                "source_url": "https://alpha.edu/sports/mens-basketball/schedule/2026-27",
                "fixtures": [{
                    "date": "2027-01-08",
                    "role": "home",
                    "opponent": "Beta University",
                    "source_time_as_posted": "4:00 PM",
                    "source_time_zone": "America/Chicago",
                    "start_time": "4:00 PM ET",
                }],
            }
            p.write_text(json.dumps({
                "season": "2026-27", "schema": 1,
                "schools": [school], "live_school_sources": [],
                "certification_assertions": [],
            }), encoding="utf-8")
            teams = {
                "alpha": {"id": "alpha", "name": "Alpha University", "slug": "alpha"},
                "beta": {"id": "beta", "name": "Beta University", "slug": "beta"},
            }
            with self.assertRaisesRegex(ValueError, "conversion mismatch"):
                apply_official_school_grid_snapshots(
                    "men", {}, teams, registry_file=p, live_sources=False,
                    today=dt.date(2026, 11, 5))
            school["fixtures"][0]["start_time"] = "5:00 PM ET"
            games = {}
            counts = apply_official_school_grid_snapshots(
                "men", games, teams, registry_file=p, live_sources=False,
                today=dt.date(2026, 11, 5))
            self.assertEqual(counts["created"], 1)
            self.assertEqual(next(iter(games.values()))["start_time"], "5:00 PM ET")

    def test_non_dii_and_neutral_games_are_not_removed_from_evidence(self):
        data = json.loads(GRID.read_text(encoding="utf-8"))
        men = next(x for x in data["schools"] if x.get("gender") == "men"
                   and x.get("owner_id") == "minnesota-state-university-moorhead")
        women = next(x for x in data["schools"] if x.get("gender") == "women"
                     and x.get("owner_id") == "central-washington-university")
        self.assertIn(("2026-10-22", "North Dakota State University (Exh.)"),
                      {(r["date"], r["opponent"]) for r in men["fixtures"]})
        self.assertIn(("2026-12-12", "Eastern Oregon"),
                      {(r["date"], r["opponent"]) for r in women["fixtures"]})
        self.assertEqual(next(r["role"] for r in men["fixtures"]
                              if r["date"] == "2026-11-13"), "neutral")
        self.assertEqual(next(r["role"] for r in women["fixtures"]
                              if r["date"] == "2026-11-13"), "neutral")
        self.assertEqual(next(r["start_time"] for r in women["fixtures"]
                              if r["date"] == "2027-02-27"), "8:00 PM ET")


if __name__ == "__main__":
    unittest.main()

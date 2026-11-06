"""Official-school DII calendar recovery: Parkside and Lake Erie evidence + neutral venue provenance."""
import datetime as dt
import json
import re
import tempfile
import unittest
from pathlib import Path

from scripts.build_d2_basketball import apply_official_school_grid_snapshots

ROOT = Path(__file__).resolve().parents[1]
GRID = ROOT / "data" / "d2-official-school-grids-2026-27.json"


class D2ParksideLakeErieCalendars(unittest.TestCase):
    def test_captured_official_rows_are_unique_and_not_certifications(self):
        d = json.loads(GRID.read_text(encoding="utf-8"))
        self.assertEqual(d["season"], "2026-27")
        for owner, number in [("parkside-wisconsin-parkside", 28), ("lake-erie", 29)]:
            rows = [s for s in d["schools"]
                    if s.get("gender") == "men" and s.get("owner_id") == owner]
            self.assertEqual(len(rows), 1, owner)
            school = rows[0]
            self.assertTrue(school["source_url"].startswith("https://"))
            self.assertEqual(len(school["fixtures"]), number)
            self.assertEqual(len({(r["date"], r["opponent"])
                                  for r in school["fixtures"]}), number)
            self.assertFalse(any(r["opponent"] == "TBA"
                                 for r in school["fixtures"]))
            for row in school["fixtures"]:
                self.assertIn(row["role"], ("home", "away", "neutral"))
                self.assertRegex(row["date"], r"^202[67]-\d\d-\d\d$")
                if row.get("start_time"):
                    self.assertRegex(row["start_time"],
                                     r"^(?:[1-9]|1[0-2]):[0-5]\d [AP]M ET$")
            self.assertFalse(any(a.get("gender") == "men" and
                                 a.get("owner_id") == owner
                                 for a in d["certification_assertions"]))
        parkside = next(s for s in d["schools"] if s.get("owner_id") == "parkside-wisconsin-parkside")
        self.assertEqual(next(r["start_time"] for r in parkside["fixtures"]
                              if r["date"] == "2027-01-07"), "7:30 PM ET")
        lake = next(s for s in d["schools"] if s.get("owner_id") == "lake-erie")
        self.assertEqual(next(r["role"] for r in lake["fixtures"]
                              if r["date"] == "2026-11-14"), "neutral")

    def test_neutral_does_not_inherit_the_schools_home_arena_source(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "grid.json"
            p.write_text(json.dumps({
                "schema": 1, "season": "2026-27", "schools": [{
                    "gender": "men", "owner_id": "alpha",
                    "source_url": "https://alpha.edu/basketball/2026-27",
                    "home_venue": "Alpha Fieldhouse",
                    "fixtures": [
                        {"date": "2027-02-01", "role": "neutral",
                         "opponent": "Beta University", "start_time": ""},
                        {"date": "2027-02-02", "role": "home",
                         "opponent": "Beta University", "start_time": ""},
                    ],
                }], "live_school_sources": [], "certification_assertions": []
            }), encoding="utf-8")
            games = {}
            teams = {"alpha": {"name": "Alpha University", "slug": "alpha"},
                     "beta": {"name": "Beta University", "slug": "beta"}}
            report = apply_official_school_grid_snapshots(
                "men", games, teams, registry_file=p, live_sources=False,
                today=dt.date(2026, 11, 5))
            self.assertEqual(report["created"], 2)
            neutral = next(g for g in games.values() if g["neutral"])
            home = next(g for g in games.values() if not g["neutral"])
            self.assertEqual(neutral["venue"], "")
            self.assertNotIn("venue_source_url", neutral)
            self.assertEqual(home["venue"], "Alpha Fieldhouse")
            self.assertEqual(home["venue_source_url"],
                             "https://alpha.edu/basketball/2026-27")


if __name__ == "__main__":
    unittest.main()

"""Protect exact official-source labels and opponent identities for 2026-27 men's DII calendar recovery."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRID = ROOT / "data" / "d2-official-school-grids-2026-27.json"


class D2NamedOpponentIdentityRecovery(unittest.TestCase):
    def test_recovered_source_names_and_identity_sources_are_not_lost(self):
        data = json.loads(GRID.read_text(encoding="utf-8"))
        count = 0
        for school in data["schools"]:
            if school.get("gender") != "men":
                continue
            for fixture in school.get("fixtures", []):
                if fixture.get("identity_verified_by", "").startswith(
                    "Official school schedule opponent naming matched"):
                    count += 1
                    self.assertNotEqual(fixture["opponent"], fixture["source_opponent"])
                    self.assertRegex(fixture["opponent_identity_source_url"],
                                     r"^https://")
                    self.assertRegex(fixture["date"], r"^202[67]-\\d\\d-\\d\\d$")
                    self.assertNotIn("away_score", fixture)
                    self.assertNotIn("home_score", fixture)
                    self.assertNotIn("status", fixture)
        self.assertEqual(count, 33)
        self.assertFalse(data["certification_assertions"])

    def test_ambiguous_and_other_division_opponents_remain_unresolved(self):
        data = json.loads(GRID.read_text(encoding="utf-8"))
        men = {s["owner_id"]: s for s in data["schools"] if s["gender"] == "men"}
        def names(owner):
            return {f["opponent"] for f in men[owner]["fixtures"]}
        self.assertIn("North Dakota State University (Exh.)",
                      names("minnesota-state-moorhead"))
        self.assertIn("Concordia University (Wis.)",
                      names("parkside-wisconsin-parkside"))
        self.assertIn("Bryant & Stratton (Ohio)", names("salem"))
        self.assertIn("Wayne State University", names("minnesota-state-moorhead"))

    def test_specific_division_ii_opponents_resolve_to_unambiguous_names(self):
        data = json.loads(GRID.read_text(encoding="utf-8"))
        men = {s["owner_id"]: s for s in data["schools"] if s["gender"] == "men"}
        checks = [
            ("salem", "California University of Pennsylvania", "California (PA)"),
            ("west-liberty", "Pitt-Johnstown", "Pittsburgh–Johnstown"),
            ("lake-erie", "Ferris State University (@LSSU)", "Ferris State"),
            ("parkside-wisconsin-parkside", "Wayne State University", "Wayne State (MI)"),
            ("minnesota-state-moorhead", "Wayne State College", "Wayne State (NE)"),
        ]
        for owner, literal, canonical in checks:
            matches = [r for r in men[owner]["fixtures"]
                       if r.get("source_opponent") == literal]
            self.assertTrue(matches, (owner, literal))
            self.assertTrue(all(r["opponent"] == canonical for r in matches))


if __name__ == "__main__":
    unittest.main()

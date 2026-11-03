"""Validate district-by-district map-era comparisons without deleting historical elections.

Run with: python -m unittest test_politics_boundary_comparability.py
"""
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


class BoundaryComparabilityAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.boundaries = load("politics-district-boundary-comparability.json")
        cls.atlas = load("politics-house-atlas.json")
        cls.recent = load("politics-historical-contests.json")
        cls.early = load("politics-historical-archive.json")

    def test_full_435_id_coverage(self):
        records = self.boundaries["records"]
        atlas_ids = {row["id"] for row in self.atlas["districts"]}
        self.assertEqual(len(atlas_ids), 435)
        self.assertEqual(set(records), atlas_ids)
        self.assertEqual(self.boundaries["districts"], 435)

    def test_2026_geometry_is_not_inferred_from_statewide_redistricting(self):
        allowed = {
            "unchanged_state_vintage",
            "pending_district_block_comparison",
            "verified_same_district_blocks",
            "verified_changed_district_blocks",
        }
        counts = Counter()
        for district, record in self.boundaries["records"].items():
            with self.subTest(district=district):
                status = record["status"]
                self.assertIn(status, allowed)
                counts[status] += 1
                self.assertTrue(record["source_url"].startswith("https://"))
                if status == "pending_district_block_comparison":
                    self.assertIsNone(record["same_2026_geography"])
                elif status == "verified_changed_district_blocks":
                    self.assertIs(record["same_2026_geography"], False)
                else:
                    self.assertIs(record["same_2026_geography"], True)
        self.assertEqual(counts["unchanged_state_vintage"], self.boundaries["unchanged_state_vintage_count"])
        self.assertEqual(counts["pending_district_block_comparison"], self.boundaries["pending_district_block_comparison_count"])

    def test_previous_election_results_preserved_when_boundaries_changed(self):
        # A changed district does not invalidate its historical election result;
        # it invalidates an unsupported claim that the old vote reflects the new map.
        all_history = self.recent["house"] + self.early["house"]
        by_id = {row["id"] for row in all_history}
        for district, record in self.boundaries["records"].items():
            with self.subTest(district=district):
                self.assertIn(district, by_id)
                if record["status"] == "verified_changed_district_blocks":
                    self.assertIs(record["same_2026_geography"], False)

    def test_same_party_finalists_are_not_forced_into_democrat_republican_matchups(self):
        atlas = {row["id"]: row for row in self.atlas["districts"]}
        ca12 = atlas["CA-12"]["2024_house_result_on_prior_boundaries"]
        self.assertEqual([x["party"] for x in ca12["finalists"]], ["D", "D"])
        self.assertEqual(len(ca12["finalists"]), 2)
        self.assertTrue(ca12["candidate_vote_source_url"].startswith("https://"))


if __name__ == "__main__":
    unittest.main()

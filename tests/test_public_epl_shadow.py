"""Research shadow uses published, synthetic-like fixtures without promotion."""
import copy
import unittest
from public_ratings.epl_shadow import build_shadow

def fixture(fid="1"):
    return {"fixture_id": fid, "kickoff_utc": "2026-11-01T12:00:00Z",
            "home": {"id": "A", "name": "Alpha", "expected_goals": 1.6},
            "away": {"id": "B", "name": "Beta", "expected_goals": 1.1},
            "probabilities": {"home": 0.47, "draw": 0.25, "away": 0.28}}

def feed(fixtures=None):
    return {"competition": "EPL", "schema_version": 1,
            "issued_at_utc": "2026-10-27T12:00:00Z",
            "fixtures": [fixture()] if fixtures is None else fixtures}

class EplShadowTests(unittest.TestCase):
    def test_shadow_does_not_modify_input_or_claim_promotion(self):
        value = feed()
        before = copy.deepcopy(value)
        result = build_shadow(value)
        self.assertEqual(value, before)
        self.assertEqual(result["fixture_count"], 1)
        self.assertIn("not_validated", result["status"])
        self.assertEqual(result["fixtures"][0]["baseline_probabilities"], value["fixtures"][0]["probabilities"])
        self.assertAlmostEqual(sum(result["fixtures"][0]["research_probabilities"].values()), 1)
        self.assertGreater(result["mean_absolute_probability_gap_percentage_points"], 0)

    def test_duplicate_fixture_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            build_shadow(feed([fixture(), fixture()]))

    def test_invalid_probability_rejected(self):
        x = fixture()
        x["probabilities"]["away"] = -0.1
        with self.assertRaisesRegex(ValueError, "probability"):
            build_shadow(feed([x]))

    def test_identical_teams_rejected(self):
        x = fixture()
        x["away"]["id"] = "A"
        with self.assertRaisesRegex(ValueError, "different"):
            build_shadow(feed([x]))

    def test_invalid_expected_goals_rejected(self):
        x = fixture()
        x["home"]["expected_goals"] = float("nan")
        with self.assertRaisesRegex(ValueError, "expected-goals"):
            build_shadow(feed([x]))

    def test_empty_feed_rejected(self):
        with self.assertRaisesRegex(ValueError, "No public"):
            build_shadow(feed([]))

if __name__ == "__main__":
    unittest.main()

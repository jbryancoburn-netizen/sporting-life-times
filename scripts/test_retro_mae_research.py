#!/usr/bin/env python3
"""Synthetic regression tests for the isolated RETRO research scripts."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

mae = load_module("retro_mae_shadow_lab")
venue = load_module("retro_venue_orientation_audit")

class RETROResearchTests(unittest.TestCase):
    def test_margin_shadow_uses_strictly_earlier_days(self):
        rows = []
        for i, day in enumerate(("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04")):
            pred = 0.0
            actual = 10 if i < 2 else 0
            rows.append({"date": day, "id": str(i), "home_id": "a", "away_id": "b",
                         "predicted_home_margin": pred, "actual_home_margin": actual,
                         "absolute_margin_error": abs(actual-pred)})
        report = {"games": rows, "season": "test", "sport": "men"}
        result = mae.evaluate(report, holdout_days=2)
        self.assertEqual(result["holdout_games"], 2)
        self.assertEqual(result["heldout_by_date"]["2026-11-03"]["prior_mean_signed_error"], 10.0)
        self.assertEqual(result["heldout_by_date"]["2026-11-04"]["prior_mean_signed_error"], round(20/3, 5))
        self.assertEqual(result["status"], "SHADOW_ONLY_NOT_PROMOTED")

    def test_reject_duplicate_score(self):
        g = {"date": "2026-11-01", "id": "1", "home_id": "a", "away_id": "b",
             "predicted_home_margin": 1, "actual_home_margin": 2,
             "absolute_margin_error": 1}
        with self.assertRaises(ValueError):
            mae.evaluate({"games": [g, dict(g)]}, holdout_days=1)

    def test_reject_mismatched_absolute_error(self):
        g = {"date": "2026-11-01", "id": "1", "home_id": "a", "away_id": "b",
             "predicted_home_margin": 1, "actual_home_margin": 2,
             "absolute_margin_error": 4}
        with self.assertRaises(ValueError):
            mae.evaluate({"games": [g]}, holdout_days=1)

    def test_audit_preserves_disagreement_and_orientation(self):
        archive = {"predictions": [
            {"date": "2026-11-01", "id": "a", "home_id": "h", "away_id": "v", "venue_verification": "verified_home"},
            {"date": "2026-11-01", "id": "b", "home_id": "x", "away_id": "y", "venue_verification": "unverified"}]}
        finals = {"events": [
            {"date": "2026-11-01", "id": "a", "home_id": "h", "away_id": "v", "neutral": True},
            {"date": "2026-11-01", "id": "b", "home_id": "y", "away_id": "x", "neutral": False}]}
        report = {"season": "test", "sport": "men", "games": [
            {"date": "2026-11-01", "id": "a", "predicted_home_margin": 1, "actual_home_margin": 4}],
            "excluded_orientation_mismatches": ["b"]}
        result = venue.audit(archive, report, finals)
        self.assertEqual(result["potential_venue_label_conflict_count"], 1)
        self.assertEqual(len(result["reversed_home_away_exclusions"]), 1)
        self.assertEqual(result["other_identity_exclusions"], [])

if __name__ == "__main__":
    unittest.main()

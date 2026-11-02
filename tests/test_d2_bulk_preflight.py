"""Regression tests for DII staging-only source preflight."""
import importlib.util
import pathlib
import unittest

MODULE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "d2_bulk_preflight.py"
spec = importlib.util.spec_from_file_location("d2_bulk_preflight", MODULE)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class D2BulkPreflightTests(unittest.TestCase):
    def sample(self):
        return {"season": "2026-27", "schools": [{
            "gender": "men", "owner_id": "sample", "source_url": "https://example.edu/schedule",
            "fixtures": [{"date": "2026-11-20", "role": "home",
                          "opponent": "Sample Opponent", "start_time": "7:00 PM ET"}]
        }], "certification_assertions": []}

    def test_valid_snapshot_is_not_certification(self):
        errors, warnings, summary = preflight.check_registry(self.sample())
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])
        self.assertEqual(summary["assertions"], 0)
        self.assertEqual(summary["source_rows"], 1)

    def test_duplicate_school_rejected(self):
        data = self.sample()
        data["schools"].append(dict(data["schools"][0]))
        errors, _, _ = preflight.check_registry(data)
        self.assertTrue(any("duplicated school" in error for error in errors))

    def test_duplicate_game_rejected(self):
        data = self.sample()
        data["schools"][0]["fixtures"] *= 2
        errors, _, _ = preflight.check_registry(data)
        self.assertTrue(any("duplicate dated opponent" in error for error in errors))

    def test_missing_clock_is_warning_not_fabricated(self):
        data = self.sample()
        data["schools"][0]["fixtures"][0]["start_time"] = ""
        errors, warnings, _ = preflight.check_registry(data)
        self.assertEqual(errors, [])
        self.assertTrue(any("no verified posted tipoff" in warning for warning in warnings))

    def test_malformed_source_blocked(self):
        data = self.sample()
        data["schools"][0]["source_url"] = "http://invalid"
        errors, _, _ = preflight.check_registry(data)
        self.assertTrue(any("https URL" in error for error in errors))

    def test_no_fabricated_attestation(self):
        data = self.sample()
        data["certification_assertions"] = [{"gender": "men", "owner_id": "sample"}]
        errors, _, _ = preflight.check_registry(data)
        self.assertTrue(any("missing reviewer" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

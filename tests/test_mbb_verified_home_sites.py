"""Regression tests for source-backed RETRO home-court verification."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from mbb_verified_home_sites import apply_verified_home_sites


class VerifiedHomeSiteTests(unittest.TestCase):
    def setUp(self):
        self.fixture = {"date": "2026-11-08", "away_id": "ncaa:2", "home_id": "ncaa:1",
                        "venue_verification": "unverified"}
        self.crosswalk = {"teams": [
            {"id": "ncaa:1", "espn_id": "111"},
            {"id": "ncaa:2", "espn_id": "222"}]}
        self.sites = {"games": {"2026-11-08|222|111": {
            "arena": "The Home Arena", "neutral": False,
            "verification": "exact_official_game_site",
            "source": "https://school.example.edu/schedule"}}, "conflict_keys": []}
        self.registry = {"teams": {"111": {
            "home_arena": "The Home Arena",
            "home_arena_source": "https://school.example.edu/arena"}}}

    def check(self, fixture=None):
        fixtures = [fixture or dict(self.fixture)]
        result = apply_verified_home_sites(fixtures, self.crosswalk, self.sites, self.registry)
        return fixtures[0], result

    def test_verified_exact_match(self):
        g, c = self.check()
        self.assertEqual(g["venue_verification"], "verified_home")
        self.assertEqual(c["verified_home"], 1)
        self.assertEqual(g["venue_evidence_key"], "2026-11-08|222|111")

    def test_neutral_never_receives_home_edge(self):
        self.sites["games"]["2026-11-08|222|111"]["neutral"] = True
        g, c = self.check()
        self.assertEqual(g["venue_verification"], "unverified")
        self.assertEqual(c["neutral_site"], 1)

    def test_mismatched_arena_fails_closed(self):
        self.sites["games"]["2026-11-08|222|111"]["arena"] = "Another Arena"
        g, c = self.check()
        self.assertEqual(g["venue_verification"], "unverified")
        self.assertEqual(c["unverified_arena"], 1)

    def test_changed_opponents_fail_closed(self):
        g, c = self.check({**self.fixture, "away_id": "ncaa:999"})
        self.assertEqual(g["venue_verification"], "unverified")

    def test_conflicted_site_fails_closed(self):
        self.sites["conflict_keys"].append("2026-11-08|222|111")
        g, c = self.check()
        self.assertEqual(g["venue_verification"], "unverified")
        self.assertEqual(c["conflicting_site"], 1)

    def test_old_verified_evidence_cleared_after_date_change(self):
        g = {**self.fixture, "date": "2026-11-09",
             "venue_verification": "verified_home",
             "venue_evidence_method": "official_fixture_home_arena_match",
             "venue_source_url": "https://old.example.edu/game",
             "venue_evidence_key": "2026-11-08|222|111"}
        actual, c = self.check(g)
        self.assertEqual(actual["venue_verification"], "unverified")
        self.assertNotIn("venue_source_url", actual)
        self.assertEqual(c["old_evidence_cleared"], 1)

    def test_separately_verified_manual_site_preserved(self):
        g = {**self.fixture, "venue_verification": "verified_neutral",
             "venue_source_url": "https://other.example.edu/fixture"}
        actual, c = self.check(g)
        self.assertEqual(actual["venue_verification"], "verified_neutral")
        self.assertEqual(c["unchanged_manual"], 1)

    def test_unverified_source_url_is_rejected(self):
        self.sites["games"]["2026-11-08|222|111"]["source"] = "http://not-verified.test"
        actual, _ = self.check()
        self.assertEqual(actual["venue_verification"], "unverified")

    def test_idempotent_on_same_verified_fixture(self):
        first, c1 = self.check()
        second, c2 = self.check(first)
        self.assertEqual(first, second)
        self.assertEqual(c1["verified_home"], c2["verified_home"])


if __name__ == "__main__":
    unittest.main()

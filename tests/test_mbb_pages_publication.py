"""Regression tests: public MBB Pages checks must not fail on pregame mornings."""
import unittest
from datetime import datetime, timezone
from scripts.verify_mbb_publication import compare

NOW = datetime(2026, 11, 12, 13, 18, tzinfo=timezone.utc)


def feed(phase="pre", stamp="2026-11-12T12:00:00+00:00",
         day="2026-11-12", score="0"):
    return {"scores_updated_at": stamp, "games": [{
        "id": "401920073", "date": day + "T23:00:00Z", "state": phase,
        "teams": [{"id": "140", "score": score}, {"id": "2244", "score": score}]
    }]}


class PagesScoreVerificationTest(unittest.TestCase):
    def test_pregame_morning_does_not_require_final(self):
        self.assertEqual(compare(feed(), feed(), NOW), [])

    def test_pregame_missing_public_game_is_failure(self):
        public = feed()
        public["games"] = []
        self.assertTrue(compare(feed(), public, NOW))

    def test_stale_public_timestamp_is_failure(self):
        self.assertIn("Public scores_updated_at is older than staged feed",
                      compare(feed(), feed(stamp="2026-11-12T11:00:00+00:00"), NOW))

    def test_missing_final_must_fail(self):
        self.assertTrue(compare(feed("post", score="90"), feed("pre"), NOW))

    def test_matching_final_passes(self):
        self.assertEqual(compare(feed("post", score="90"), feed("post", score="90"), NOW), [])

    def test_live_regression_is_failure(self):
        self.assertTrue(compare(feed("in", score="55"), feed("pre"), NOW))

    def test_later_public_live_score_is_allowed(self):
        self.assertEqual(compare(feed("in", score="55"), feed("in", score="56"), NOW), [])

    def test_off_day_checks_full_feed(self):
        self.assertEqual(compare(feed(day="2026-11-13"),
                                 feed(day="2026-11-13"), NOW), [])

    def test_no_source_games_is_failure(self):
        self.assertTrue(compare({"games": []}, feed(), NOW))


if __name__ == "__main__":
    unittest.main()

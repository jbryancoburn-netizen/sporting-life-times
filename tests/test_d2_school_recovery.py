"""Regression tests: school-by-school DII coverage is measured, never guessed."""
import unittest

from scripts.audit_d2_publication import school_schedule_coverage


class D2SchoolRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.teams = [
            {"id": "a", "name": "Alpha", "conference": "North"},
            {"id": "b", "name": "Bravo", "conference": "North"},
            {"id": "c", "name": "Charlie", "conference": "South",
             "not_eligible_for_dii_elo": True},
            {"id": "d", "name": "Delta", "conference": "South"},
        ]
        self.games = [
            {"id": "one", "away": "a", "home": "b", "status": "scheduled",
             "start_time": "6:00 PM ET", "venue": "", "network": ""},
            {"id": "two", "away": "b", "home": "d", "status": "final",
             "neutral": True, "start_time": "", "venue": "Verified arena",
             "network": "Official school stream"},
        ]

    def test_zero_coverage_and_thin_schedules_are_independent(self):
        info = school_schedule_coverage(self.teams, self.games)
        self.assertEqual(info["programs_with_published_games"], 3)
        self.assertEqual(info["without_games"], 1)
        self.assertEqual(info["with_1_to_6_games"], 3)
        self.assertEqual([x["id"] for x in info["zero_game_schools"]], ["c"])
        self.assertTrue(info["zero_game_schools"][0]["membership_pending"])
        thin = {x["id"]: x for x in info["thin_schedule_priority"]}
        self.assertEqual(thin["b"]["published_fixtures"], 2)
        self.assertEqual(thin["b"]["finals"], 1)
        self.assertEqual(thin["b"]["with_network"], 1)
        self.assertEqual(thin["d"]["with_venue"], 1)
        self.assertEqual(info["conference_gaps"]["South"]["without_games"], 1)

    def test_no_double_count_on_invalid_duplicate_school_reference(self):
        info = school_schedule_coverage(self.teams, [
            {"id": "one", "away": "a", "home": "a", "status": "scheduled"}
        ])
        self.assertEqual(info["programs_with_published_games"], 1)
        self.assertEqual(info["without_games"], 3)
        self.assertEqual(info["thin_schedule_priority"][0]["published_fixtures"], 1)

    def test_does_not_infer_unpublished_conference_games(self):
        info = school_schedule_coverage(self.teams, [])
        self.assertEqual(info["without_games"], 4)
        self.assertEqual(info["with_1_to_6_games"], 0)
        self.assertEqual(info["conference_gaps"]["North"]["fixture_appearances"], 0)
        self.assertIn("not full-school schedule certifications", info["disclaimer"])


if __name__ == "__main__":
    unittest.main()

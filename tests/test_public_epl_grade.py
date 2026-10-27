"""Deterministic tests for locked pregame EPL comparison grading."""
import copy
import unittest

from public_ratings.epl_grade import advance, merge_verified_results


def fixture(fid="123", kickoff="2026-10-31T15:00:00+00:00"):
    return {"fixture_id": fid, "kickoff_utc": kickoff,
            "home": {"id": "1", "name": "Alpha", "expected_goals": 1.6},
            "away": {"id": "2", "name": "Beta", "expected_goals": 1.1},
            "probabilities": {"home": 0.47, "draw": 0.25, "away": 0.28}}


def feed(issued="2026-10-27T15:00:00+00:00", fixtures=None, recent=None):
    return {"schema_version": 1, "competition": "EPL", "issued_at_utc": issued,
            "fixtures": fixtures if fixtures is not None else [fixture()],
            "recent_results": recent if recent is not None else []}


class EplGradeTests(unittest.TestCase):
    def test_first_pregame_forecast_locked_then_graded_without_overwrite(self):
        first = advance(feed(), {}, "2026-10-27T15:05:00+00:00")
        self.assertEqual(first["summary"]["locked_count"], 1)
        original = copy.deepcopy(first["locked"]["123"])
        changed = fixture()
        changed["probabilities"] = {"home": 0.3, "draw": 0.3, "away": 0.4}
        second = advance(feed("2026-10-27T16:00:00+00:00", [changed]), first,
                         "2026-10-27T16:05:00+00:00")
        self.assertEqual(second["locked"]["123"], original)
        final = {"fixture_id": "123", "home": "Alpha", "away": "Beta",
                 "home_score": 2, "away_score": 0, "kickoff_utc": "2026-10-31T15:00:00+00:00"}
        third = advance(feed("2026-10-31T18:00:00+00:00", [fixture("other", "2026-11-01T15:00:00+00:00")], [final]),
                        second, "2026-10-31T18:05:00+00:00")
        self.assertEqual(third["summary"]["graded_count"], 1)
        self.assertEqual(third["graded"]["123"]["outcome"], "home")
        self.assertGreater(third["graded"]["123"]["baseline"]["log_loss"], 0)
        self.assertGreater(third["graded"]["123"]["research"]["brier"], 0)
        fourth = advance(feed("2026-10-31T19:00:00+00:00", [fixture("other", "2026-11-01T15:00:00+00:00")], [final]),
                         third, "2026-10-31T19:05:00+00:00")
        self.assertEqual(fourth["graded"], third["graded"])
        self.assertEqual(fourth["summary"]["new_grades"], 0)

    def test_no_after_kickoff_backfill(self):
        result = advance(feed("2026-10-31T15:30:00+00:00"),
                         {}, "2026-10-31T15:31:00+00:00")
        self.assertEqual(result["summary"]["locked_count"], 0)

    def test_stale_source_rejected(self):
        with self.assertRaisesRegex(ValueError, "twelve hours"):
            advance(feed(), {}, "2026-10-28T16:00:00+00:00")

    def test_changed_participants_rejected(self):
        prior = advance(feed(), {}, "2026-10-27T15:05:00+00:00")
        final = {"fixture_id": "123", "home": "Other", "away": "Beta",
                 "home_score": 1, "away_score": 0, "kickoff_utc": "2026-10-31T15:00:00+00:00"}
        with self.assertRaisesRegex(ValueError, "participants"):
            advance(feed("2026-10-31T19:00:00+00:00", [fixture("other", "2026-11-01T15:00:00+00:00")], [final]),
                    prior, "2026-10-31T19:05:00+00:00")

    def test_never_grade_missing_forecast(self):
        final = {"fixture_id": "999", "home": "Alpha", "away": "Beta",
                 "home_score": 1, "away_score": 0, "kickoff_utc": "2026-10-25T15:00:00+00:00"}
        result = advance(feed(recent=[final]), {}, "2026-10-27T15:05:00+00:00")
        self.assertEqual(result["summary"]["graded_count"], 0)


    def test_merge_archive_includes_old_verified_finals(self):
        old = {"fixture_id": "123", "home": "Alpha", "away": "Beta", "home_score": 2,
               "away_score": 0, "kickoff_utc": "2026-10-31T15:00:00+00:00"}
        ratings = {"completed_matches": 1, "as_of_date": "2026-10-31", "season_results": [old]}
        merged = merge_verified_results(feed("2026-10-31T18:00:00+00:00", [fixture("other", "2026-11-01T15:00:00+00:00")], []), ratings)
        self.assertEqual(merged["recent_results"], [old])
        prior = advance(feed(), {}, "2026-10-27T15:05:00+00:00")
        graded = advance(merged, prior, "2026-10-31T18:05:00+00:00")
        self.assertEqual(graded["summary"]["graded_count"], 1)

    def test_conflicting_recent_and_archive_results_are_rejected(self):
        result = {"fixture_id": "123", "home": "Alpha", "away": "Beta",
                  "home_score": 2, "away_score": 0, "kickoff_utc": "2026-10-31T15:00:00+00:00"}
        different = {**result, "away_score": 1}
        ratings = {"completed_matches": 1, "as_of_date": "2026-10-31", "season_results": [result]}
        with self.assertRaisesRegex(ValueError, "Conflicting verified"):
            merge_verified_results(feed(recent=[different]), ratings)

    def test_incomplete_verified_archive_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "does not reconcile"):
            merge_verified_results(feed(), {"completed_matches": 2, "as_of_date": "2026-10-31", "season_results": []})


if __name__ == "__main__":
    unittest.main()

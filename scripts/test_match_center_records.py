"""Regression tests for verified Match Center records and balanced collection."""
import unittest
from match_center_records import choose_games, merge_record, has_verified_detail


class MatchCenterRecordTests(unittest.TestCase):
    def test_empty_provider_result_preserves_verified_history(self):
        previous = {"events": [{"text": "Goal"}], "statistics": [], "players": [],
                    "fetched_at": "earlier", "game": {"state": "in"}}
        fresh = {"events": [], "statistics": [], "players": [],
                 "game": {"state": "post", "teams": [{"score": "2"}, {"score": "1"}]}}
        result = merge_record(previous, fresh)
        self.assertEqual(result["events"], previous["events"])
        self.assertEqual(result["fetched_at"], "earlier")
        self.assertEqual(result["game"]["state"], "post")

    def test_real_new_detail_replaces_stale(self):
        self.assertEqual(merge_record({"events": [{"text": "Old"}]},
                                      {"events": [{"text": "New"}]})["events"][0]["text"], "New")

    def test_empty_records_not_verified(self):
        self.assertFalse(has_verified_detail(None))
        self.assertFalse(has_verified_detail({"events": [], "players": []}))
        self.assertTrue(has_verified_detail({"players": [{"name": "A"}]}))

    def test_selection_balances_all_three_states(self):
        games = [{"id": str(i), "state": state, "date": "2026-10-22T18:00:00Z"}
                 for state, offset in (("post", 0), ("pre", 100), ("in", 200))
                 for i in range(offset + 1, offset + 9)]
        selected = choose_games(games)
        self.assertEqual(len(selected), 12)
        self.assertEqual(len({g["id"] for g in selected}), 12)
        for state in ("post", "pre", "in"):
            self.assertEqual(sum(g["state"] == state for g in selected), 4)

    def test_selection_fills_missing_state_without_duplicates(self):
        games = [{"id": str(i), "state": "post", "date": "2026-10-22T18:00:00Z"} for i in range(15)]
        selected = choose_games(games)
        self.assertEqual(len(selected), 12)
        self.assertEqual(len({g["id"] for g in selected}), 12)

    def test_duplicate_ids_do_not_consume_state_quota(self):
        games = [{"id": "1", "state": "in", "date": "2026-10-22T18:00:00Z"}] * 5
        games += [{"id": str(i), "state": "in", "date": "2026-10-22T18:00:00Z"} for i in range(2, 7)]
        games += [{"id": str(i), "state": "post", "date": "2026-10-22T18:00:00Z"} for i in range(10, 16)]
        selected = choose_games(games, limit=8, per_state=4)
        self.assertEqual(sum(g["state"] == "in" for g in selected), 4)
        self.assertEqual(sum(g["state"] == "post" for g in selected), 4)
        self.assertEqual(len({g["id"] for g in selected}), 8)

    def test_missing_date_is_allowed(self):
        selected = choose_games([{"id": "abc", "state": "pre"}])
        self.assertEqual([g["id"] for g in selected], ["abc"])

    def test_selection_skips_missing_identifiers(self):
        self.assertEqual(choose_games([{"state": "pre"}, {"id": "1", "state": "pre"}]),
                         [{"id": "1", "state": "pre"}])


if __name__ == "__main__":
    unittest.main()

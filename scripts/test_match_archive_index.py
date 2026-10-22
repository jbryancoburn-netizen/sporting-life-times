"""Regression tests for the source-backed historical game index."""
import unittest
from build_match_archive_index import build_index


def game(id, league="NBA", date="2026-10-22T20:00:00Z"):
    return {"game": {"id": id, "league": league, "date": date,
                     "teams": [{"name": "Home"}, {"name": "Away"}]}}


class HistoricalIndexTests(unittest.TestCase):
    def test_index_includes_active_and_historical_games(self):
        result = build_index({"games": {"NBA::1": game("1")}},
                             [("data/match_archive_shards/2025-10.json", {"NBA::2": game("2")})])
        self.assertEqual(len(result["games"]), 2)
        self.assertEqual({r["source"] for r in result["games"]},
                         {"match_details.json", "data/match_archive_shards/2025-10.json"})

    def test_active_record_takes_precedence(self):
        result = build_index({"games": {"NBA::1": game("1")}},
                             [("data/match_archive_shards/2025-10.json", {"NBA::1": game("1")})])
        self.assertEqual(len(result["games"]), 1)
        self.assertEqual(result["games"][0]["source"], "match_details.json")

    def test_missing_identity_excluded(self):
        result = build_index({"games": {"NBA::1": {"events": []}, "NBA::2": game("2")}}, [])
        self.assertEqual([r["key"] for r in result["games"]], ["NBA::2"])

    def test_bad_shard_rejected(self):
        with self.assertRaises(ValueError):
            build_index({"games": {}}, [("bad.json", [])])

    def test_newest_first(self):
        result = build_index({"games": {"NBA::1": game("1", date="2025-01-01T00:00:00Z"),
                                        "NBA::2": game("2", date="2026-01-01T00:00:00Z")}}, [])
        self.assertEqual([r["id"] for r in result["games"]], ["2", "1"])


if __name__ == "__main__":
    unittest.main()

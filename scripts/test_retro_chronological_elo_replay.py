#!/usr/bin/env python3
"""Synthetic chronology and selection tests for the 2026-27 score-only replay."""
import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().with_name("retro_chronological_elo_replay.py")
spec = importlib.util.spec_from_file_location("retro_replay", PATH)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ReplayTests(unittest.TestCase):
    def games(self, second_score=60):
        return {"season": "fixture", "events": [
            {"date": "2026-11-01", "id": "1", "home_id": "a", "away_id": "b",
             "home_score": 80, "away_score": 60, "site_verified": True, "neutral": False},
            {"date": "2026-11-01", "id": "2", "home_id": "a", "away_id": "c",
             "home_score": 80, "away_score": second_score, "site_verified": False, "neutral": True},
            {"date": "2026-11-02", "id": "3", "home_id": "a", "away_id": "b",
             "home_score": 90, "away_score": 60, "site_verified": False, "neutral": True}
        ]}
    def test_same_day_predictions_are_frozen(self):
        rows = m.replay(m.valid_games(self.games(), "2026-11-03"),24,.55,.05681226)
        self.assertEqual(rows[0]["predicted"], 0.)
        self.assertEqual(rows[1]["predicted"], 0.)
        self.assertGreater(rows[2]["predicted"], 0.)
    def test_same_day_outcome_cannot_change_other_same_day_prediction(self):
        a = m.replay(m.valid_games(self.games(60), "2026-11-03"),24,.55,.05681226)
        b = m.replay(m.valid_games(self.games(50), "2026-11-03"),24,.55,.05681226)
        self.assertEqual(a[0]["predicted"], b[0]["predicted"])
        self.assertEqual(a[1]["predicted"], b[1]["predicted"])
        self.assertNotEqual(a[2]["predicted"], b[2]["predicted"])
    def test_future_scores_do_not_select_training_parameters(self):
        one = m.experiment(self.games(60),.05681226,"2026-11-02","2026-11-03")
        changed = self.games(60)
        changed["events"][2]["home_score"] = 120
        two = m.experiment(changed,.05681226,"2026-11-02","2026-11-03")
        self.assertEqual(one["selected_training_only"]["k"], two["selected_training_only"]["k"])
        self.assertEqual(one["selected_training_only"]["mov"],two["selected_training_only"]["mov"])
    def test_identity_and_duplicate_validation(self):
        bad = self.games()
        bad["events"].append(dict(bad["events"][0]))
        with self.assertRaises(ValueError):
            m.valid_games(bad,"2026-11-03")

if __name__=="__main__":
    unittest.main()

"""Regression tests for opponent-strength evidence. No remote source needed."""
import unittest
from build_ncaam_player_opponent_elo import pregame_opponents, exposure

class OpponentEvidenceTests(unittest.TestCase):
    def test_same_day_opponent_rating_cannot_see_earlier_result(self):
        # Mock games() to expose sequentially ordered contests on the same date.
        from unittest.mock import patch
        contests=[
            ("2025-11-03","g1","a","b",100,60),
            ("2025-11-03","g2","a","c",85,70),
            ("2025-11-04","g3","b","c",65,80),
        ]
        with patch("build_ncaam_player_opponent_elo.games", return_value=(contests,{"a","b","c"})):
            out=pregame_opponents([],[])
        self.assertEqual(out["g1"]["a"],1500.)
        self.assertEqual(out["g2"]["c"],1500.)
        self.assertEqual(out["g2"]["a"],1500.)
        self.assertNotEqual(out["g3"]["c"],1500.)

    def test_minutes_weighted_competition_exposure(self):
        rows=[
            {"team":"High Point","player_id":"77","contest_id":"one","mins":"20","pts":"14"},
            {"team":"High Point","player_id":"77","contest_id":"two","mins":"30","pts":"18"},
        ]
        from backtest_ncaam_roster_elo import clean
        t=clean("High Point")
        out=exposure(rows,{"one":{t:1400},"two":{t:1600}})
        self.assertEqual(out["matched_player_games"],2)
        p=out["player_exposure"][0]
        self.assertAlmostEqual(p["opponent_pregame_elo"],1520.)
        self.assertEqual(p["points"],32.)
        self.assertEqual(p["minutes"],50.)

    def test_duplicate_player_game_is_rejected(self):
        row={"team":"High Point","player_id":"77","contest_id":"one","mins":"20","pts":"14"}
        from backtest_ncaam_roster_elo import clean
        with self.assertRaisesRegex(ValueError,"Duplicate player game"):
            exposure([row,row],{"one":{clean("High Point"):1500}})
if __name__=="__main__":unittest.main()

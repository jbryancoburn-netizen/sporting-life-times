import unittest
from build_ncaam_player_opponent_elo import pregame_opponents,exposure

class PregameOpponentTests(unittest.TestCase):
    def test_pre_game_not_post_game(self):
        schedule=[{"contest_id":"1","home":"Alpha","away":"Beta","game_date":"11/01/2025","home_score":"80","away_score":"70"},
                  {"contest_id":"2","home":"Alpha","away":"Beta","game_date":"11/02/2025","home_score":"80","away_score":"70"}]
        members=[{"team":"Alpha"},{"team":"Beta"}]
        pre=pregame_opponents(schedule,members)
        self.assertEqual(pre["1"]["alpha"],1500.)
        self.assertEqual(pre["1"]["beta"],1500.)
        self.assertGreater(pre["2"]["beta"],1500.)
        self.assertLess(pre["2"]["alpha"],1500.)
    def test_player_exposure_uses_opponent_not_own(self):
        rows=[{"team":"Alpha","player_id":"5","contest_id":"2","mins":"20","pts":"10"}]
        pre={"2":{"alpha":1450.,"beta":1550.}}
        result=exposure(rows,pre)
        self.assertEqual(result["player_exposure"][0]["opponent_pregame_elo"],1450.)
        self.assertFalse(result["player_exposure"][0]["quality_status"]=="approved")
    def test_missing_game_is_unmatched(self):
        self.assertEqual(exposure([{"team":"Alpha","player_id":"5","contest_id":"9"}],{})["unmatched_player_games"],1)
if __name__=="__main__":unittest.main()

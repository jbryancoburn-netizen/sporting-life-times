import unittest
from audit_ncaam_opponent_exposure import strength_exposure

class OpponentExposureTests(unittest.TestCase):
    def test_home_and_away_opponents(self):
        base={"home_ncaa_team_id":"10","away_ncaa_team_id":"20","contest_id":"9","mins":"20"}
        rows=[dict(base,team_ncaa_team_id="10",player_id="1"),
              dict(base,team_ncaa_team_id="20",player_id="2")]
        result=strength_exposure(rows)
        self.assertEqual(result["matched_player_games"],2)
        self.assertEqual(result["distinct_opponents"],2)
        self.assertEqual(result["unmatched_player_games"],0)
    def test_unrelated_school_not_misassigned(self):
        row={"home_ncaa_team_id":"10","away_ncaa_team_id":"20",
             "team_ncaa_team_id":"30","contest_id":"9","player_id":"1"}
        self.assertEqual(strength_exposure([row])["unmatched_player_games"],1)
    def test_duplicate_player_game_rejected(self):
        row={"home_ncaa_team_id":"10","away_ncaa_team_id":"20",
             "team_ncaa_team_id":"10","contest_id":"9","player_id":"1","mins":"20"}
        with self.assertRaises(ValueError):strength_exposure([row,row])
if __name__=="__main__":unittest.main()

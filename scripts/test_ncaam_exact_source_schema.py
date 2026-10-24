import unittest
from backtest_ncaam_quality_retrospective import preseason_features

class RealisticRosterSchemaTests(unittest.TestCase):
    def test_rosters_without_team_id_are_accepted(self):
        roster=[{"team":"Sample College","player":f"Player {i}"} for i in range(10)]
        previous=[{"team":"Sample College","team_ncaa_team_id":"1234",
          "player":f"Player {i}","contest_id":"game-a","mins":"20","pts":"8"}
          for i in range(10)]
        features,teams,audit=preseason_features(roster,previous)
        self.assertIn("sample college",features)
        self.assertEqual(features["sample college"]["covered"],False)
        self.assertEqual(audit["current_roster_players"],10)
if __name__=="__main__":unittest.main()

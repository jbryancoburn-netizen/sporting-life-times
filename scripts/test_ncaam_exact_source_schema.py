import unittest
from backtest_ncaam_quality_retrospective import preseason_features

class RealisticRosterSchemaTests(unittest.TestCase):
    def test_rosters_without_team_id_are_accepted(self):
        roster=[{"team":"Sample College","player":f"Player {i}"} for i in range(10)]
        # Ten players x six unique contests x twenty minutes = 1,200
        # real minutes, above the feature coverage minimum of 1,000.
        previous=[{"team":"Sample College","team_ncaa_team_id":"1234",
            "player":f"Player {i}","contest_id":f"game-{game}",
            "mins":"20","pts":"8"}
            for game in range(6) for i in range(10)]
        features,teams,audit=preseason_features(roster,previous)
        self.assertIn("sample college",features)
        self.assertTrue(features["sample college"]["covered"])
        self.assertEqual(audit["current_roster_players"],10)
        self.assertEqual(audit["unique_exact_prior_name_matches"],10)
        self.assertEqual(audit["covered_teams"],1)

    def test_conflicting_present_team_ids_still_rejected(self):
        roster=[{"team":"Sample College","team_id": "100","player": "One"},
                {"team":"Sample College","team_id": "200","player": "Two"}]
        with self.assertRaisesRegex(ValueError,"two current-team IDs"):
            preseason_features(roster,[])
if __name__=="__main__":unittest.main()

import unittest
from reconcile_ncaam_candidate_exposure import reconcile

class CandidateExposureTests(unittest.TestCase):
    def test_exact_historical_team_player_link_still_unverified(self):
        movement={"teams":[{"team":"New School","team_id":"ncaa:20",
            "players":[{"player":"Alex Sample","status":"unique-name-transfer-candidate",
                        "prior_school_id":"ncaa:10"}]}]}
        exposure={"player_exposure":[{"team_key":"oldschool","historical_player_id":"99",
            "minutes":400,"opponent_pregame_elo":1610.5}]}
        box=[{"team_ncaa_team_id":"10","team":"Old School",
              "player_id":"99","clean_name":"Alex Sample"}]
        out=reconcile(movement,exposure,box)
        self.assertEqual(out["counts"]["competition_exposure_candidate"],1)
        self.assertFalse(out["identity_verified"])
        self.assertFalse(out["production_elo_approved"])
        self.assertEqual(out["teams"][0]["candidate_exposure"][0]["prior_opponent_pregame_elo"],1610.5)
    def test_ambiguous_identity_not_matched(self):
        movement={"teams":[{"team":"New School","team_id":"ncaa:20",
            "players":[{"player":"Alex Sample","status":"unique-name-transfer-candidate",
                        "prior_school_id":"ncaa:10"}]}]}
        exposure={"player_exposure":[]}
        box=[{"team_ncaa_team_id":"10","team":"Old School","player_id":str(pid),
              "clean_name":"Alex Sample"} for pid in (99,100)]
        out=reconcile(movement,exposure,box)
        self.assertEqual(out["counts"]["historical_identity_ambiguous"],1)
if __name__=="__main__":unittest.main()

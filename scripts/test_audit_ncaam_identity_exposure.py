import unittest
from audit_ncaam_identity_exposure import reconcile

def registry():return {"teams":[{"id":"ncaa:"+str(i),"name":"Team "+str(i)} for i in range(1,366)]}
class ExposureTests(unittest.TestCase):
    def test_verified_transfer_opponent_exposure_remains_candidate(self):
        identity={"matched":[{"team_id":"ncaa:2","prior_team_id":"ncaa:1",
          "ncaa_box_status":"unique-ncaa-box-candidate","ncaa_box_player_id":"99"}]}
        exposure={"player_exposure":[{"team_key":"oldschool","historical_player_id":"99",
            "minutes":400,"opponent_pregame_elo":1580}]}
        box=[{"team_ncaa_team_id":"1","team":"Old School"}]
        out=reconcile(identity,exposure,box,registry())
        t=next(x for x in out["teams"] if x["team_id"]=="ncaa:2")
        self.assertEqual(t["verified_espn_transfers"],1)
        self.assertEqual(t["candidate_exposure_players"],1)
        self.assertEqual(t["candidate_minutes_weighted_opponent_elo"],1580)
        self.assertFalse(out["production_elo_approved"])
    def test_ambiguous_historical_team_name_rejected(self):
        identity={"matched":[{"team_id":"ncaa:2","prior_team_id":"ncaa:1",
          "ncaa_box_status":"unique-ncaa-box-candidate","ncaa_box_player_id":"99"}]}
        exposure={"player_exposure":[]}
        box=[{"team_ncaa_team_id":"1","team":"Old School"},{"team_ncaa_team_id":"1","team":"Other School"}]
        out=reconcile(identity,exposure,box,registry())
        self.assertEqual(out["counts"]["unresolved_exposure"],1)
if __name__=="__main__":unittest.main()

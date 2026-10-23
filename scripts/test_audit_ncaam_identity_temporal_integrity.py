import unittest
from audit_ncaam_identity_temporal_integrity import audit
class GateTests(unittest.TestCase):
    def inputs(self):
        identity={"teams_current":365,"teams_prior":364,"historical_roster_asof_verified":False,
          "counts":{"verified_espn_returner":3,"verified_espn_d1_transfer":2},
          "duplicate_current_athlete_ids":{}}
        production={"teams_audited":365,"cross_provider_identity_verified":False,
          "counts":{"verified_espn_returners":3,"verified_espn_transfers":2,"unique_ncaa_box_candidates":4,"unresolved_box_candidates":1}}
        exposure={"teams_audited":365,"opponent_adjustment_calibrated_for_verified_identities":False,
          "counts":{"verified_espn_returners":3,"verified_espn_transfers":2,"candidate_exposure_players":3,"unresolved_exposure":2}}
        return identity,production,exposure
    def test_unverified_roster_timing_and_cross_provider_ids_hold_release(self):
        result=audit(*self.inputs())
        self.assertFalse(result["release_approved"])
        self.assertEqual(result["espn_identity_verified_players"],5)
        self.assertTrue(result["release_blockers"]["historical_roster_asof_not_proven"])
        self.assertTrue(result["release_blockers"]["historical_season_payload_not_source_verified"])
    def test_mismatched_movement_totals_fail(self):
        i,p,e=self.inputs()
        p["counts"]["verified_espn_transfers"]=1
        with self.assertRaises(ValueError):audit(i,p,e)
    def test_missing_audited_movement_fails(self):
        i,p,e=self.inputs()
        p["counts"]["unresolved_box_candidates"]=0
        with self.assertRaises(ValueError):audit(i,p,e)
    def test_exposure_more_than_production_fails(self):
        i,p,e=self.inputs()
        e["counts"]["candidate_exposure_players"]=5
        with self.assertRaises(ValueError):audit(i,p,e)
if __name__=="__main__":unittest.main()

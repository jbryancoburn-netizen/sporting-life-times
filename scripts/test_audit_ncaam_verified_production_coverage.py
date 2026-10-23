import unittest
from audit_ncaam_verified_production_coverage import audit

def registry():
    return {"teams":[{"id":"ncaa:"+str(i),"name":"Team "+str(i)} for i in range(1,366)]}
def ledger():
    return {"player_records":[{"team_id":"ncaa:1","player_id":"999",
        "minutes":450,"totals":{"pts":180}}]}
class CoverageTests(unittest.TestCase):
    def test_verified_espn_transfer_with_box_candidate_is_not_production_approved(self):
        identity={"matched":[{"team_id":"ncaa:2","prior_team_id":"ncaa:1",
          "espn_status":"verified_espn_d1_transfer","ncaa_box_status":"unique-ncaa-box-candidate",
          "ncaa_box_player_id":"999"}]}
        result=audit(identity,ledger(),registry())
        self.assertEqual(result["teams_audited"],365)
        self.assertEqual(result["counts"]["verified_espn_transfers"],1)
        self.assertEqual(result["counts"]["unique_ncaa_box_candidates"],1)
        team=next(x for x in result["teams"] if x["team_id"]=="ncaa:2")
        self.assertEqual(team["candidate_transfer_minutes"],450)
        self.assertFalse(result["production_elo_approved"])
        self.assertFalse(team["cross_provider_identity_verified"])
    def test_missing_box_record_not_fabricated(self):
        identity={"matched":[{"team_id":"ncaa:2","prior_team_id":"ncaa:1",
          "espn_status":"verified_espn_d1_transfer","ncaa_box_status":"unique-ncaa-box-candidate",
          "ncaa_box_player_id":"404"}]}
        result=audit(identity,ledger(),registry())
        self.assertEqual(result["counts"]["unresolved_box_candidates"],1)
        self.assertEqual(result["counts"].get("unique_ncaa_box_candidates",0),0)
if __name__=="__main__":unittest.main()

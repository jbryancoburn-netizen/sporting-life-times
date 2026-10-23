import unittest
from reconcile_ncaam_verified_espn_ids import reconcile

class IdentityTests(unittest.TestCase):
    def test_same_provider_id_verifies_continuity_not_cross_provider(self):
        old={"rosters":[{"ncaa_id":"ncaa:10","players":[{"id":"123","name":"A Sample"}]}]}
        current={"rosters":[{"ncaa_id":"ncaa:10","school":"School","players":[{"id":"123","name":"A Sample"}]}]}
        box=[{"team_ncaa_team_id":"10","player_id":"999","clean_name":"A Sample"}]
        r=reconcile(old,current,box)
        self.assertEqual(r["counts"]["verified_espn_continuity"],1)
        self.assertEqual(r["counts"]["unique-ncaa-box-candidate"],1)
        self.assertFalse(r["matched"][0]["ncaa_box_identity_verified"])
        self.assertEqual(r["matched"][0]["ncaa_box_player_id"],"999")
    def test_espn_id_name_conflict_rejected(self):
        old={"rosters":[{"ncaa_id":"ncaa:10","players":[{"id":"123","name":"A Sample"}]}]}
        current={"rosters":[{"ncaa_id":"ncaa:10","school":"School","players":[{"id":"123","name":"B Sample"}]}]}
        r=reconcile(old,current,[])
        self.assertEqual(r["counts"]["ambiguous_or_conflicting_espn_id"],1)
        self.assertEqual(r["matched"],[])
    def test_verified_transfer_across_different_espn_schools(self):
        old={"rosters":[{"ncaa_id":"ncaa:10","players":[{"id":"123","name":"A Sample"}]}]}
        current={"rosters":[{"ncaa_id":"ncaa:20","school":"New School",
            "players":[{"id":"123","name":"A Sample"}]}]}
        box=[{"team_ncaa_team_id":"10","player_id":"999","clean_name":"A Sample"}]
        r=reconcile(old,current,box)
        self.assertEqual(r["counts"]["verified_espn_d1_transfer"],1)
        self.assertEqual(r["matched"][0]["prior_team_id"],"ncaa:10")
        self.assertEqual(r["matched"][0]["team_id"],"ncaa:20")
        self.assertFalse(r["matched"][0]["ncaa_box_identity_verified"])
    def test_duplicate_current_id_cannot_be_verified_twice(self):
        old={"rosters":[{"ncaa_id":"ncaa:10","players":[{"id":"123","name":"A Sample"}]}]}
        current={"rosters":[
            {"ncaa_id":"ncaa:10","school":"Old School","players":[{"id":"123","name":"A Sample"}]},
            {"ncaa_id":"ncaa:20","school":"New School","players":[{"id":"123","name":"A Sample"}]}]}
        r=reconcile(old,current,[])
        self.assertEqual(r["counts"]["duplicate_current_espn_id"],2)
        self.assertEqual(r["matched"],[])
    def test_duplicate_id_within_one_current_school_is_rejected(self):
        old={"rosters":[{"ncaa_id":"ncaa:10","players":[{"id":"123","name":"A Sample"}]}]}
        current={"rosters":[{"ncaa_id":"ncaa:10","school":"Old School",
            "players":[{"id":"123","name":"A Sample"},{"id":"123","name":"A Sample"}]}]}
        r=reconcile(old,current,[])
        self.assertEqual(r["counts"]["duplicate_current_espn_id"],2)
        self.assertEqual(r["matched"],[])
if __name__=="__main__":unittest.main()

import unittest
from reconcile_ncaam_player_identities import reconcile

class ReconciliationTests(unittest.TestCase):
    def test_rejects_incomplete_registry(self):
        with self.assertRaises(ValueError):
            reconcile({"teams":[]},{"teams":[]})

    def test_flags_are_not_identity_verification(self):
        teams=[]
        registry=[]
        for i in range(365):
            uid="ncaa:"+str(i)
            registry.append({"id":uid,"name":"School "+str(i)})
            players=[{"current_id":str(i)+"-"+str(j),
                      "player":"Player "+str(j),
                      "status":"no-prior-d1-box",
                      "prior_school_id":None} for j in range(10)]
            teams.append({"team_id":uid,"team":"School "+str(i),"players":players})
        result=reconcile({"teams":teams},{"teams":registry})
        self.assertEqual(result["teams_checked"],365)
        self.assertEqual(result["teams_with_flags"],365)
        self.assertEqual(result["identity_verified_players"],0)
        self.assertFalse(result["eligible_for_transfer_elo"])
        self.assertEqual(len(result["team_audit"]),365)

if __name__=="__main__":
    unittest.main()

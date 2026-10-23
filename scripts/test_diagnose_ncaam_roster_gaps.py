import unittest
from diagnose_ncaam_roster_gaps import diagnose
class GapTests(unittest.TestCase):
    def test_reports_missing_and_partial_separately(self):
        reg={"teams":[{"id":"ncaa:1","name":"One"},{"id":"ncaa:2","name":"Two"}]}
        old={"season":2026,"rosters":[{"ncaa_id":"ncaa:1","school":"One","players":[{"id":"1"}]}],"failed":[{"team":"Two","error":"404"}]}
        now={"season":2027,"rosters":[{"ncaa_id":"ncaa:1","school":"One","players":[{}]*8},
                                      {"ncaa_id":"ncaa:2","school":"Two","players":[{}]*8}]}
        result=diagnose(old,now,reg)
        self.assertEqual(result["missing_prior"][0]["team"],"Two")
        self.assertEqual(result["partial_prior"][0]["listed_players"],1)
        self.assertEqual(result["missing_current"],[])
        self.assertFalse(result["release_approved"])
if __name__=="__main__":unittest.main()

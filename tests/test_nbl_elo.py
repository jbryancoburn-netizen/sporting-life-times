import unittest
from scripts.nbl_elo import model, TEAMS, K

class NBLEloTests(unittest.TestCase):
    def setUp(self):
        self.baseline={"certified":True,"season":"test-only","ratings":{team:1500 for team in TEAMS}}
        self.game={"id":"test-game","played_at":"2026-09-19T09:00:00Z","home":"Sydney Kings",
            "away":"Perth Wildcats","home_score":100,"away_score":95,
            "verified":True,"source_url":"https://example.org/test-only"}
    def test_rating_balance_and_home_edge(self):
        out=model(self.baseline,[self.game])
        ratings={r["team"]:r["elo"] for r in out["ratings"]}
        self.assertEqual(out["games_processed"],1)
        self.assertAlmostEqual(sum(ratings.values()),15000,places=2)
        self.assertGreater(ratings["Sydney Kings"],1500)
        self.assertLess(ratings["Perth Wildcats"],1500)
        self.assertLess(out["recent_results"][0]["home_win_probability"],1)
        self.assertGreater(out["recent_results"][0]["home_win_probability"],.5)
    def test_duplicate_final_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"duplicate"):
            model(self.baseline,[self.game,self.game])
    def test_uncertified_baseline_rejected(self):
        self.baseline["certified"]=False
        with self.assertRaisesRegex(ValueError,"certified"):
            model(self.baseline,[self.game])
    def test_unverified_score_rejected(self):
        self.game["verified"]=False
        with self.assertRaisesRegex(ValueError,"Unverified"):
            model(self.baseline,[self.game])
    def test_no_draws_in_final(self):
        self.game["away_score"]=100
        with self.assertRaisesRegex(ValueError,"Invalid final"):
            model(self.baseline,[self.game])
    def test_out_of_order_results(self):
        second={**self.game,"id":"earlier","played_at":"2026-09-18T09:00:00Z"}
        with self.assertRaisesRegex(ValueError,"chronological"):
            model(self.baseline,[self.game,second])
if __name__=="__main__": unittest.main()

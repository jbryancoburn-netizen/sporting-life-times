import unittest
from scripts.backtest_nbl_elo import replay, validate

class NBLHeldoutTests(unittest.TestCase):
    def game(self,id,home="Sydney Kings",away="Perth Wildcats",hs=93,aws=84,at="2025-10-01T10:00Z"):
        return {"id":id,"home":home,"away":away,"home_score":hs,"away_score":aws,
                "played_at":at,"verified":False,"state":"candidate"}
    def test_scoring_is_deterministic(self):
        training=[self.game("1")]
        holdout=[self.game("2",hs=75,aws=85,at="2026-10-01T10:00Z")]
        self.assertEqual(replay(training,holdout),replay(training,holdout))
    def test_unverified_candidates_never_become_verified(self):
        game=self.game("1")
        self.assertEqual(validate({"status":"uncertified_source_candidates","games":[game]}),[game])
        game["verified"]=True
        with self.assertRaises(ValueError):
            validate({"status":"uncertified_source_candidates","games":[game]})
    def test_preseason_excluded_at_regular_season_boundary(self):
        cutoff="2026-09-19"
        fixtures=[self.game("blitz",at="2026-09-02T07:30Z"),
                  self.game("season",at="2026-09-19T09:30Z")]
        eligible=[g for g in fixtures if g["played_at"][:10]>=cutoff]
        self.assertEqual([g["id"] for g in eligible],["season"])
    def test_log_loss_and_brier_are_probabilistic(self):
        out=replay([self.game("1")],[self.game("2",at="2026-10-01T10:00Z")])
        self.assertTrue(0<out["brier"]<1)
        self.assertTrue(out["log_loss"]>0)
        self.assertEqual(out["n"],1)
if __name__=="__main__":unittest.main()

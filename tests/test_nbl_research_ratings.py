import unittest
from scripts.publish_nbl_research_elo import calculate

TEAMS=("Adelaide 36ers","Brisbane Bullets","Cairns Taipans","Illawarra Hawks",
"Melbourne United","New Zealand Breakers","Perth Wildcats",
"South East Melbourne Phoenix","Sydney Kings","Tasmania JackJumpers")

class NBLResearchRatingsTests(unittest.TestCase):
    def baseline(self):
        return {"status":"RESEARCH_ONLY_UNCERTIFIED","training_games":337,
            "parameters":{"k":20,"home_advantage_elo":65,"offseason_regression":1.0},
            "sources":{"archive_run":"https://example.com/a"},
            "ratings_end_2025_26":{t:1500 for t in TEAMS}}
    def game(self,ident,at="2026-10-01T06:00:00Z"):
        return {"id":ident,"played_at":at,"home":"Sydney Kings","away":"Perth Wildcats",
            "home_score":88,"away_score":72,"source_url":"https://www.espn.com/nbl/game/_/gameId/1",
            "state":"candidate","verified":False}
    def ledger(self,games):
        return {"season":"2026-27","source_status":"uncertified_source_candidates","games":games}
    def test_ten_real_ratings_without_forecast_certification(self):
        result=calculate(self.baseline(),self.ledger([self.game("1")]))
        self.assertEqual(len(result["ratings"]),10)
        self.assertFalse(result["prediction_certified"])
        self.assertFalse(result["production_approved"])
        self.assertEqual(sum(x["wins"] for x in result["ratings"]),1)
        self.assertLess(abs(sum(x["elo"] for x in result["ratings"])-15000),1)
    def test_historical_strength_never_carries_into_new_season(self):
        baseline=self.baseline()
        baseline["ratings_end_2025_26"]["Sydney Kings"]=1900
        baseline["ratings_end_2025_26"]["Perth Wildcats"]=1100
        result=calculate(baseline,self.ledger([self.game("one")]))
        self.assertAlmostEqual(result["chronological_comparator"]["Sydney Kings"],1500+20*(1-1/(1+10**(-65/400))),places=2)
        self.assertEqual(result["rating_method"],"RETRO completed-game network refit")
        self.assertEqual(result["season_start_elo"],1500)
        self.assertTrue(result["reset_every_season"])
    def test_replaying_same_result_is_blocked(self):
        with self.assertRaises(ValueError):
            calculate(self.baseline(),self.ledger([self.game("1"),self.game("1")]))
    def test_preseason_never_enters_ratings(self):
        with self.assertRaises(ValueError):
            calculate(self.baseline(),self.ledger([self.game("2",at="2026-09-02T10:00:00Z")]))
    def test_unverified_status_cannot_be_promoted(self):
        game=self.game("3")
        game["verified"]=True
        with self.assertRaises(ValueError):
            calculate(self.baseline(),self.ledger([game]))
if __name__=="__main__":unittest.main()

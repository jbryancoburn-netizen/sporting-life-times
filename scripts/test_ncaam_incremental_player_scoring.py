import unittest
from datetime import date
from backtest_ncaam_opponent_quality import quality_continuity,evaluate_quality

class IncrementalPlayerScoringTests(unittest.TestCase):
    def test_historical_transfer_scoring_and_opponent_are_separate(self):
        box=[{"team":"Old School","player_id":"91","clean_name":"Taylor Example","mins":"25","pts":"12",
              "contest_id":str(i)} for i in range(45)]
        roster=[{"team":"New School","player":"Taylor Example"}]
        quality={"oldschool":{"91":{"minutes":1125,"opponent_pregame_elo":1640}}}
        opponent,scoring,efficiency=quality_continuity(box,roster,{"newschool"},quality,{"oldschool":1600.},return_scoring=True)
        self.assertAlmostEqual(opponent["newschool"],40.)
        self.assertAlmostEqual(scoring["newschool"],0.)
        self.assertNotIn("newschool",efficiency)
    def test_scoring_coefficient_zero_is_identical_to_incumbent(self):
        names=[f"t{i}" for i in range(202)]
        games=[(date(2025,11,5),str(i),names[i%202],names[(i+1)%202],81,72) for i in range(201)]
        feature={n:{"retention":0.45,"incoming_minutes":0.25} for n in names}
        quality={n:float(i%9)*12 for i,n in enumerate(names)}
        scoring={n:float(i%5)*.03 for i,n in enumerate(names)}
        prev={n:1500. for n in names}
        old=evaluate_quality(games,prev,feature,quality,-20)
        new=evaluate_quality(games,prev,feature,quality,-20,scoring=scoring,scoring_beta=0)
        self.assertEqual(old,new)
        altered=evaluate_quality(games,prev,feature,quality,-20,scoring=scoring,scoring_beta=400)
        self.assertEqual(old["matched_games_sha256"],altered["matched_games_sha256"])
        self.assertNotAlmostEqual(old["log_loss"],altered["log_loss"])
if __name__=="__main__":unittest.main()

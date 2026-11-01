"""Offline checks for truly independent, walk-forward DII Elo calibration."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_calibrate_historical_elo import eval_model,fit

def sample(n=840):
    teams={f"school-{i}":{} for i in range(150)}
    games=[]
    for i in range(n):
        away=f"school-{(i*17)%150}"
        home=f"school-{(i*17+7+i//150)%150}"
        if away==home:home=f"school-{(i*17+1)%150}"
        games.append({"id":str(i),"date":f"2026-{(i//180)+1:02d}-{i%28+1:02d}",
         "away":away,"home":home,"neutral":i%7==0,
         "away_score":72+(i%11),"home_score":71+((i*3)%18)})
    return games,teams

class CalibrationTests(unittest.TestCase):
    def test_fresh_1500_elo_no_carryover_and_neutral_home_edge(self):
        games,teams=sample(10)
        one=eval_model(games,teams,20,0)
        two=eval_model(games,teams,20,80)
        self.assertTrue(math.isfinite(one))
        self.assertTrue(math.isfinite(two))
        self.assertNotEqual(one,two)
        self.assertEqual(one,eval_model(games,teams,20,0))
    def test_sample_guard_prevents_fictitious_calibration(self):
        games,teams=sample(200)
        with self.assertRaises(ValueError):fit(games,teams)
    def test_selection_has_chronological_validation_and_holdout(self):
        games,teams=sample()
        fitted=fit(games,teams)
        self.assertEqual(fitted["sample_games"],len(games))
        self.assertEqual(fitted["train_games"]+fitted["validation_games"]+fitted["test_games"],len(games))
        self.assertIn(fitted["k"],(10,14,18,22,26,30,34,38))
        self.assertIn(fitted["home_elo_edge"],(0,20,40,60,80,100,120))
        self.assertGreater(fitted["test_games"],100)
        self.assertGreater(fitted["unseen_test_log_loss"],0)
        self.assertTrue(fitted["no_previous_year_rating_carryover"])
if __name__=="__main__":unittest.main()

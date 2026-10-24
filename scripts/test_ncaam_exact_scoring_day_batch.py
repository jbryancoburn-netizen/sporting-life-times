import unittest
from datetime import date,timedelta
from backtest_ncaam_quality_retrospective import season_prediction

class SameDayScoringTest(unittest.TestCase):
    def test_same_day_reordering_never_changes_predictions(self):
        teams=[f"t{i}" for i in range(202)]
        features={t:{"minute_adj":(i%5)*8,"q_centered":(i%7)*.01}
                  for i,t in enumerate(teams)}
        previous={t:1500 for t in teams}
        day=date(2025,11,4)
        games=[{"id":str(i),"day":day,"home":teams[i%202],
                "away":teams[(i+1)%202],"home_score":83,"away_score":72}
                for i in range(201)]
        first=season_prediction(games,previous,features,1000)
        reversed_games=season_prediction(list(reversed(games)),previous,features,1000)
        self.assertEqual(first["games"],201)
        self.assertAlmostEqual(first["log_loss"],reversed_games["log_loss"],places=12)
        self.assertAlmostEqual(first["brier"],reversed_games["brier"],places=12)
    def test_strong_scoring_impact_is_not_capped(self):
        teams=[f"t{i}" for i in range(202)]
        features={t:{"minute_adj":0.0,"q_centered":(1. if i%2 else -1.)}
                  for i,t in enumerate(teams)}
        previous={t:1500 for t in teams}
        games=[{"id":str(i),"day":date(2025,11,4),"home":teams[i],
                "away":teams[i+1],"home_score":80,"away_score":75}
                for i in range(0,202,2)]
        zero=season_prediction(games,previous,features,0)
        strong=season_prediction(games,previous,features,1000)
        self.assertNotAlmostEqual(zero["log_loss"],strong["log_loss"])
if __name__=="__main__":unittest.main()

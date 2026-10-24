import unittest
from datetime import date,timedelta
from backtest_ncaam_quality_retrospective import season_prediction,unadjusted_end

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
    def test_same_day_results_do_not_change_next_day_rating_by_order(self):
        day=date(2025,11,4)
        teams=[f"t{i}" for i in range(202)]
        features={t:{"minute_adj":0.0,"q_centered":0.0} for t in teams}
        previous={t:1500 for t in teams}
        # t0 plays twice on the opening day, so sequential updates bias day two.
        first=[
            {"id":"0","day":day,"home":"t0","away":"t1","home_score":90,"away_score":70},
            {"id":"1","day":day,"home":"t0","away":"t2","home_score":60,"away_score":85},
        ]
        later=[{"id":f"later-{i}","day":day+timedelta(days=1),
            "home":teams[i],"away":teams[(i+1)%202],
            "home_score":83,"away_score":72} for i in range(201)]
        forward=season_prediction(first+later,previous,features,500)
        reverse=season_prediction(list(reversed(first))+later,previous,features,500)
        self.assertAlmostEqual(forward["log_loss"],reverse["log_loss"],places=12)
        self.assertAlmostEqual(forward["brier"],reverse["brier"],places=12)
        end_forward=unadjusted_end(first+later,previous,features)
        end_reverse=unadjusted_end(list(reversed(first))+later,previous,features)
        for team in teams:
            self.assertAlmostEqual(end_forward[team],end_reverse[team],places=10)

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

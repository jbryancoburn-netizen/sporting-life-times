"""Ensure NCAA backtests never infer intraday tipoff order from contest IDs."""
import unittest
from datetime import date
from backtest_ncaam_opponent_quality import evaluate_quality

class SameDayBacktestTests(unittest.TestCase):
    def test_same_day_fixture_order_does_not_change_predictions(self):
        # 202 identified programs, 200+ paired results on the same date.
        # One school appears in multiple fixtures to expose intra-day leakage.
        names=[f"team{i}" for i in range(202)]
        features={n:{"retention":0.4,"incoming_minutes":0.25} for n in names}
        quality={n:float(i%7)*10 for i,n in enumerate(names)}
        prior={n:1500. for n in names}
        day=date(2025,11,4)
        games=[(day,f"game{i}",names[i%202],names[(i+1)%202],90,70)
               for i in range(201)]
        a=evaluate_quality(games,prior,features,quality,80)
        b=evaluate_quality(list(reversed(games)),prior,features,quality,80)
        self.assertEqual(a["games"],201)
        self.assertAlmostEqual(a["log_loss"],b["log_loss"],places=12)
        self.assertAlmostEqual(a["brier"],b["brier"],places=12)

if __name__=="__main__":unittest.main()

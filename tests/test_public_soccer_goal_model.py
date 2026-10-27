"""Synthetic-only public tests for the portable soccer goals model."""
import math
import unittest
from public_ratings.soccer_goal_model import poisson_probs, score_distribution, fit_rates

class PublicSoccerModelTests(unittest.TestCase):
    def test_poisson_distribution_is_normalized(self):
        for lam in (0.2, 1.3, 2.8, 5.0):
            self.assertAlmostEqual(sum(poisson_probs(lam)), 1.0, places=12)

    def test_symmetric_teams_have_equal_win_probabilities(self):
        r = score_distribution(1.5, 1.5)
        self.assertAlmostEqual(r["p_home"], r["p_away"], places=10)
        self.assertAlmostEqual(sum(r[k] for k in ("p_home", "p_draw", "p_away")), 1.0)

    def test_goal_market_probabilities_are_bounded(self):
        r = score_distribution(1.3, 1.1, rho=-0.1)
        self.assertTrue(all(0 <= r[k] <= 1 for k in ("over_2_5", "btts")))
        self.assertTrue(all(x >= 0 and math.isfinite(x) for row in r["grid"] for x in row))

    def test_bad_parameters_fail_closed(self):
        with self.assertRaises(ValueError):
            poisson_probs(0)
        with self.assertRaises(ValueError):
            score_distribution(2, 2, rho=1.1)
        with self.assertRaises(ValueError):
            fit_rates([], "a", "b", prior_games=0)

    def test_synthetic_goals_inform_direction(self):
        history = [{"home": 1, "a": "alpha", "b": "beta", "sa": 3, "sb": 0} for _ in range(10)]
        home, away, details = fit_rates(history, "alpha", "beta", prior_games=2)
        self.assertGreater(home, away)
        self.assertEqual(details["home_samples"], 10)

    def test_reverse_home_encoding_is_normalized(self):
        history = [{"home": -1, "a": "beta", "b": "alpha", "sa": 0, "sb": 3} for _ in range(10)]
        home, away, _ = fit_rates(history, "alpha", "beta", prior_games=2)
        self.assertGreater(home, away)

if __name__ == "__main__":
    unittest.main()

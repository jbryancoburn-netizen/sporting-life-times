import unittest
from nba_preseason_decay import preseason_weight, evolving_elo, log_loss

class TestPreseasonDecay(unittest.TestCase):
    def test_half_life(self):
        self.assertAlmostEqual(preseason_weight(15), 0.5)
        self.assertAlmostEqual(preseason_weight(30), 0.25)
    def test_initial_and_long_run(self):
        self.assertEqual(evolving_elo(1500, 100, 0), 1600)
        self.assertAlmostEqual(evolving_elo(1500, 100, 15), 1550)
    def test_invalid(self):
        with self.assertRaises(ValueError):
            preseason_weight(-1)
        with self.assertRaises(ValueError):
            preseason_weight(5, 0)
    def test_loss(self):
        self.assertAlmostEqual(log_loss([0.5, 0.5], [0, 1]), 0.6931471805599453)
if __name__ == "__main__":
    unittest.main()

import unittest
from audit_ncaam_earlyseason_volatility import audit,shift
class VolatilityTests(unittest.TestCase):
 def test_underdog_moves_more(self):
  self.assertGreater(shift(.1,20),shift(.5,20))
  self.assertGreater(shift(.5,20),shift(.9,20))
 def test_blowout_moves_more(self):
  self.assertGreater(shift(.5,35),shift(.5,5))
 def test_current_exact_coefficients(self):
  d=audit()
  self.assertEqual((d["k"],d["mov"]),(24.,.55))
  self.assertEqual(len(d["cases"]),25)
 def test_invalid_inputs(self):
  with self.assertRaises(ValueError):shift(1.1,20)
if __name__=="__main__":unittest.main()

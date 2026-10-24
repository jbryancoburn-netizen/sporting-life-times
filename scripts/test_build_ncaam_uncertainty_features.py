import json,unittest
from pathlib import Path
from build_ncaam_uncertainty_features import build
class TestUncertaintyFeatures(unittest.TestCase):
 def setUp(self):
  d=Path("data")
  self.r=json.loads((d/"ncaam-2026-27-preseason-roster-informed.json").read_text())
  self.s=json.loads((d/"ncaam-2026-27-transfer-source-strength-audit.json").read_text())
 def test_complete_and_not_pseudo_calibrated(self):
  x=build(self.r,self.s)
  self.assertEqual(x["team_count"],365)
  self.assertEqual(len({y["team_id"] for y in x["teams"]}),365)
  self.assertFalse(x["uncertainty_coefficient_fitted"])
  self.assertFalse(x["production_elo_changed"])
  self.assertTrue(all(y["elo_update_speed_multiplier"] is None for y in x["teams"]))
 def test_fallback_has_no_imputed_churn(self):
  x=build(self.r,self.s)
  w=next(y for y in x["teams"] if y["team_id"]=="pending-ncaa-id:west-florida")
  self.assertTrue(w["missing_program_history"])
  self.assertIsNone(w["observed_roster_churn_share"])
 def test_roster_churn_not_invented(self):
  x=build(self.r,self.s)
  a={y["team_id"]:y for y in self.r["rankings"]}
  for t in x["teams"]:
   if t["observed_roster_churn_share"] is not None:
    self.assertAlmostEqual(t["observed_roster_churn_share"],1-a[t["team_id"]]["returning_minutes_share"],places=5)
if __name__=="__main__":unittest.main()

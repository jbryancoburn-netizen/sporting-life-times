#!/usr/bin/env python3
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("ledger",Path(__file__).with_name("build_ncaam_player_production.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PlayerLedgerTests(unittest.TestCase):
 def test_efficiency_and_rates_are_computed_from_totals(self):
  row={"team_ncaa_team_id":"101","player_id":"33","contest_id":"44",
       "clean_name":"Test Player","team":"Example"}
  row.update({"mins":"20","pts":"12","fga":"8","fta":"4","fgm":"4","tpm":"2"})
  r=dict(row,contest_id="45")
  result=m.aggregate([row,r])
  self.assertEqual(result[0]["minutes"],40)
  self.assertEqual(result[0]["rates_per_40"]["pts"],24)
  self.assertAlmostEqual(result[0]["effective_fg"],.625)
 def test_duplicate_contest_rejected(self):
  row={"team_ncaa_team_id":"101","player_id":"33","contest_id":"44"}
  with self.assertRaises(ValueError):m.aggregate([row,row])
 def test_invalid_minutes_not_counted(self):
  row={"team_ncaa_team_id":"101","player_id":"33","contest_id":"44","mins":"100"}
  self.assertEqual(m.aggregate([row]),[])
if __name__=="__main__":unittest.main()

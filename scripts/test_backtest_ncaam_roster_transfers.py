#!/usr/bin/env python3
import importlib.util,unittest
from pathlib import Path
from datetime import date,timedelta
spec=importlib.util.spec_from_file_location("ncaam_transfer",Path(__file__).with_name("backtest_ncaam_roster_transfers.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class TransferTests(unittest.TestCase):
 def test_unique_player_moving_school_is_counted(self):
  box=[{"team":"Indiana","clean_name":"Mila Gold","player_id":"1","mins":"1100"},
       {"team":"Purdue","clean_name":"Alex White","player_id":"2","mins":"1050"}]
  roster=[{"team":"Purdue","player":"Mila Gold"},*[
      {"team":"Purdue","player":"Other Person "+str(i)} for i in range(8)]]
  f=module.continuity(box,roster,{"purdue"})
  self.assertAlmostEqual(f["purdue"]["incoming_minutes"],1100/1050)
 def test_repeated_name_across_teams_not_claimed_as_transfer(self):
  box=[{"team":"Indiana","clean_name":"Alex White","player_id":"1","mins":"900"},
       {"team":"Purdue","clean_name":"Alex White","player_id":"2","mins":"1000"}]
  roster=[{"team":"Purdue","player":"Alex White"},*[
      {"team":"Purdue","player":"Other Person "+str(i)} for i in range(8)]]
  f=module.continuity(box,roster,{"purdue"})
  self.assertEqual(f["purdue"]["incoming_minutes"],0)
 def test_early_game_window_is_explicit(self):
  start=date(2025,11,3)
  games=[(start+timedelta(days=k),"g"+str(k),"a","b",75,70) for k in range(53)]
  feature={"a":{"retention":.4,"incoming_minutes":.2},"b":{"retention":.3,"incoming_minutes":.5}}
  result=module.evaluate(games,{"a":1550,"b":1450},feature,(20,30),days=45)
  self.assertEqual(result["games"],45)
if __name__=="__main__":unittest.main()

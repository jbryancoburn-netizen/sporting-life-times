#!/usr/bin/env python3
import importlib.util,unittest
from pathlib import Path
from datetime import date,timedelta

p=Path(__file__).with_name("backtest_ncaam_roster_elo.py")
spec=importlib.util.spec_from_file_location("backtest_ncaam",p)
x=importlib.util.module_from_spec(spec)
spec.loader.exec_module(x)
class HistoricalCalibrationTests(unittest.TestCase):
 def test_identity_cleanup_is_deterministic(self):
  self.assertEqual(x.clean("A & M"),"aandm")
  self.assertEqual(x.clean("ANGELO.BRIZZI"),x.clean("Angelo Brizzi"))
 def test_no_future_games_appear_in_validation(self):
  start=date(2025,11,3)
  games=[(start+timedelta(days=k),"g"+str(k),"A","B",80,75) for k in range(51)]
  out=x.trial(games,{"A":1520,"B":1480},{"A":.5,"B":.3},20,limit_days=45)
  self.assertEqual(out["games"],45)
  self.assertEqual(out["all_d1_games_window"],45)
 def test_margin_elo_conserves_sum(self):
  r={"a":1600.0,"b":1400.0}
  total=sum(r.values())
  x.step(r,"a","b",100,79)
  self.assertAlmostEqual(sum(r.values()),total,places=8)
 def test_exact_minutes_and_no_ambiguous_players(self):
  stats=[{"team":"Indiana","player_id":"42","clean_name":"Alex Smith","mins":"40"},
         {"team":"Indiana","player_id":"43","clean_name":"Alex Smith","mins":"30"},
         {"team":"Indiana","player_id":"44","clean_name":"Mary Jones","mins":"50"}]
  rosters=[{"team":"Indiana","player":"Alex Smith","games":"12"},
           *[{"team":"Indiana","player":"Player "+str(i),"games":"1"} for i in range(8)]]
  features,_=x.features(stats,rosters,{"indiana"})
  self.assertNotIn("indiana",features) # prior minutes below 1000
if __name__=="__main__":unittest.main()

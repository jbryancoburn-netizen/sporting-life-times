#!/usr/bin/env python3
"""Self-contained tests: historical compact-results Elo scoring, chronology, integrity."""
import csv,io,math,unittest
from backtest_ncaam_long_history_scores import score
class TestCenturyReplay(unittest.TestCase):
 def rows(self):
  return list(csv.DictReader(io.StringIO("""Season,DayNum,WTeamID,WScore,LTeamID,LScore,WLoc,NumOT
1985,1,1001,70,1002,60,H,0
1985,1,1003,68,1004,58,N,0
1985,2,1002,90,1004,70,A,0
1985,2,1001,85,1003,60,H,0
1986,1,1004,75,1001,74,N,0
1986,1,1003,80,1002,50,H,0
""")))
 def test_replay(self):
  seasons,total=score(self.rows())
  self.assertEqual(total,6)
  self.assertEqual([z["season"] for z in seasons],[1985,1986])
  self.assertTrue(all(0<x["log_loss"]<2 and 0<x["brier"]<1 for x in seasons))
  self.assertEqual(seasons[0]["games"],4)
  self.assertEqual(seasons[1]["teams"],4)
 def test_order_independent_same_day(self):
  rows=self.rows();a,_=score(rows);b,_=score(list(reversed(rows)))
  self.assertEqual(a,b)
 def test_reject_duplicate(self):
  with self.assertRaises(ValueError):score(self.rows()+[self.rows()[0]])
 def test_reject_invalid_result(self):
  rows=self.rows();rows[0]["WScore"]="45"
  with self.assertRaises(ValueError):score(rows)
if __name__=="__main__":unittest.main()

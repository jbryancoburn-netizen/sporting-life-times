#!/usr/bin/env python3
"""Unit tests for exact historical version of current NCAA player-value v1."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from backtest_ncaam_exact_player_v1 import exact_features
class FormulaTest(unittest.TestCase):
    def box(self,name,team,points):
        return [{"team":team,"player":name,"team_ncaa_team_id":"1" if team=="Duke" else "2",
                "contest_id":str(i),"mins":"40","pts":str(points)} for i in range(20)]
    def test_beta300_with_team_median_and_missing_fallback(self):
        previous=self.box("Player Alpha","Duke",25)+self.box("Player Beta","Kansas",10)
        roster=[{"team":"Duke","player":"Player Alpha"},{"team":"Kansas","player":"Player Beta"},{"team":"Yale","player":"Unknown"}]
        d,e=exact_features(roster,previous,{"duke":"1","kansas":"2","yale":"3"})
        self.assertEqual(e["quality_coefficient"],300.)
        self.assertEqual(e["unique_prior_player_matches"],2)
        self.assertEqual(e["no_prior_match_schools"],1)
        self.assertEqual(set(d),{"duke","kansas","yale"})
        self.assertGreater(d["duke"],d["yale"])
        self.assertLess(d["kansas"],d["yale"])
        self.assertEqual(d["yale"],0.)
    def test_different_school_is_supported_transfer(self):
        previous=self.box("Player Transfer","Kansas",25)
        roster=[{"team":"Duke","player":"Player Transfer"}]
        d,e=exact_features(roster,previous,{"duke":"1"})
        self.assertEqual(e["unique_prior_player_matches"],1)
        self.assertEqual(d["duke"],0.)
if __name__=="__main__":unittest.main()

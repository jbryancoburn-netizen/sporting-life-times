"""Leakage regression tests: after-cutoff athletes must NEVER enter rated features."""
import sys
import unittest
from datetime import date
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from backtest_ncaam_quality_earlyseason_asof import cut_snapshot

def make(player,when,minutes=17):
    return {"game_date":when,"team":"Duke","team_ncaa_team_id":"609720",
            "player":player,"mins":str(minutes),"pts":"11"}

class PlayerEvidenceAsOfTests(unittest.TestCase):
    def test_postcutoff_player_excluded(self):
        source=[make("Preseason.Early","11/12/2025"),
                make("Cutoff.Day","11/17/2025"),
                make("Late.Transfer","12/01/2025")]
        early,discard=cut_snapshot(source,date(2025,11,17))
        self.assertEqual(len(early),1)
        self.assertEqual(discard,2)
        self.assertEqual(early[0]["player"],"Preseason.Early")
    def test_add_late_players_does_not_mutate_prior_snapshot(self):
        first=[make("A.Player","11/11/2025"),make("B.Player","11/13/2025")]
        a,_=cut_snapshot(first,date(2025,11,17))
        b,_=cut_snapshot(first+[make("New.Transfer","11/20/2025")],date(2025,11,17))
        self.assertEqual(a,b)
    def test_zero_minute_player_not_in_active_roster(self):
        a,_=cut_snapshot([make("Inactive.Guy","11/10/2025",0),
                          make("Active.Guy","11/10/2025",4)],date(2025,11,17))
        self.assertEqual([p["player"] for p in a],["Active.Guy"])
if __name__=="__main__":
    unittest.main()

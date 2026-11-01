"""Regression tests for the persistent NBL27 fixture and every club's schedule."""
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class NBLFullSeasonFixtureTests(unittest.TestCase):
    def load(self,name):
        return json.loads((ROOT/"data"/name).read_text())

    def test_all_165_games_and_33_for_each_club(self):
        games=self.load("nbl27-season-candidates.json")["games"]
        self.assertEqual(len(games),165)
        counts=Counter(t for g in games for t in (g["home"],g["away"]))
        self.assertEqual(len(counts),10)
        self.assertTrue(all(count==33 for count in counts.values()))
        self.assertEqual(len({g["id"] for g in games}),165)

    def test_schedule_remains_uncertified_until_official_crosscheck(self):
        schedule=self.load("nbl27-season-candidates.json")
        self.assertFalse(schedule["official_verified"])
        self.assertTrue(all(g["official_nbl_verified"] is False for g in schedule["games"]))

    def test_game_center_and_club_pages_load_persistent_schedule(self):
        data=(ROOT/"nbl-schedule-data.js").read_text()
        self.assertIn("nbl27-season-candidates.json",data)
        self.assertIn("nbl-research-current-ledger.json",data)
        for page in ("nbl.html","nbl-team.html","nbl-results.html"):
            html=(ROOT/page).read_text()
            self.assertIn("nbl-schedule-data.js",html)
        self.assertIn('id="nbl-season-desk"',(ROOT/"nbl-results.html").read_text())
        self.assertIn('id="nbl-club-upcoming"',(ROOT/"nbl-team.html").read_text())

if __name__=="__main__":
    unittest.main()

#!/usr/bin/env python3
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from match_ncaam_bulk_historical_players import normalize,safe_unique_suffix_match,choose_known_team
class PlayerNames(unittest.TestCase):
    def test_alias_requires_two_player_matches(self):
        index={"col. of charleston":{"JANEPLAYER","JOHNPLAYER"}}
        self.assertEqual(choose_known_team("Charleston",["Jane Player"],index)[2],False)
        self.assertEqual(choose_known_team("Charleston",["Jane Player","John Player"],index)[2],True)
    def test_unknown_school_discovered_from_three_players(self):
        index={"different school":{"ALICEBROWN","BOBWHITE","CARLGRAY"}}
        result=choose_known_team("Unmatched School",["Alice Brown","Bob White","Carl Gray"],index)
        self.assertEqual(result[1],"different school")
        self.assertTrue(result[2])
    def test_unknown_school_needs_three_players(self):
        index={"different school":{"ALICEBROWN","BOBWHITE"}}
        self.assertFalse(choose_known_team("Unmatched School",["Alice Brown","Bob White"],index)[2])
    def test_unknown_school_ambiguous_rejected(self):
        index={"school a":{"ALICEBROWN","BOBWHITE","CARLGRAY"},
               "school b":{"ALICEBROWN","BOBWHITE","CARLGRAY"}}
        self.assertFalse(choose_known_team("Unmatched School",["Alice Brown","Bob White","Carl Gray"],index)[2])
    def test_unique_suffix(self):
        self.assertTrue(safe_unique_suffix_match("Tedrick Washington Jr.",{"TEDRICKWASHINGTON"}))
        self.assertTrue(safe_unique_suffix_match("Jordan Smith",{"JORDANSMITHJR"}))
    def test_ambiguous_rejected(self):
        self.assertFalse(safe_unique_suffix_match("Jordan Smith",{"JORDANSMITHJR","JORDANSMITHIII"}))
    def test_different_people_rejected(self):
        self.assertFalse(safe_unique_suffix_match("Jordan Smith",{"JORDANWILLIAMS"}))
if __name__=="__main__":unittest.main()

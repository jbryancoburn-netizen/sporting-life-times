#!/usr/bin/env python3
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from match_ncaam_bulk_historical_players import normalize,safe_unique_suffix_match
class PlayerNames(unittest.TestCase):
    def test_unique_suffix(self):
        self.assertTrue(safe_unique_suffix_match("Tedrick Washington Jr.",{"TEDRICKWASHINGTON"}))
        self.assertTrue(safe_unique_suffix_match("Jordan Smith",{"JORDANSMITHJR"}))
    def test_ambiguous_rejected(self):
        self.assertFalse(safe_unique_suffix_match("Jordan Smith",{"JORDANSMITHJR","JORDANSMITHIII"}))
    def test_different_people_rejected(self):
        self.assertFalse(safe_unique_suffix_match("Jordan Smith",{"JORDANWILLIAMS"}))
if __name__=="__main__":unittest.main()

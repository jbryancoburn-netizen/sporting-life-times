#!/usr/bin/env python3
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from extract_ncaam_bulk_historical_player_rosters import parse_players
class TestOfficialRosterExtraction(unittest.TestCase):
    def test_roster_profiles(self):
        html=('<a href="/sports/mens-basketball/roster/jane-smith/321"><span>Jane Smith</span></a>'
              '<a href="/sports/mens-basketball/roster/john-doe/655">John Doe</a>'
              '<a href="/sports/mens-basketball/roster/jane-smith/321">Jane Smith</a>')
        self.assertEqual(parse_players(html),["Jane Smith","John Doe"])
    def test_unrelated_links_not_players(self):
        self.assertEqual(parse_players('<a href="/sports/mens-basketball/news">Latest news</a>'),[])
if __name__=="__main__":unittest.main()

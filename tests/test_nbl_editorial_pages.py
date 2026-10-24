import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class NBLNewspaperPageTests(unittest.TestCase):
    def test_league_home_has_all_editorial_sections(self):
        text=(ROOT/"nbl.html").read_text()
        for element in ('nbl-hero-final','nbl-hero-leader','nbl-hero-elo',
                        'nbl-featured-finals','nbl-compare-desk','nbl-team-comparison',
                        'nbl-team-search','nbl-power-index'):
            with self.subTest(element=element):
                self.assertIn('id="'+element+'"',text)
        self.assertIn('nbl-editorial.css',text)
        self.assertIn('nbl-editorial.js',text)
    def test_club_pages_use_the_same_published_results(self):
        team=(ROOT/"nbl-team.html").read_text()
        code=(ROOT/"nbl-team.js").read_text()
        self.assertIn('data/nbl-standings.json',code)
        self.assertIn('data/nbl-elo-research.json',code)
        self.assertIn('data/nbl-research-current-ledger.json',code)
        self.assertIn('nbl-club-completed',team)
        self.assertIn('nbl-club-upcoming',team)
        self.assertIn('nbl-editorial.css',team)
    def test_links_and_experimental_guard(self):
        code=(ROOT/"nbl-editorial.js").read_text()
        self.assertIn("nbl-team.html?team=",code)
        self.assertIn("prediction_certified===false",code)
        self.assertIn("production_approved===false",code)
        self.assertIn("MutationObserver",code)
        research=(ROOT/"nbl-elo-desk.js").read_text()
        self.assertIn("RESEARCH_ONLY_UNCERTIFIED",research)
if __name__=="__main__":unittest.main()

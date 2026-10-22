"""Regression checks for EPL club fixture deep links and Match Center sharing."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MatchDeepLinkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.club_js = (ROOT / "epl-club.js").read_text(encoding="utf-8")
        cls.club_html = (ROOT / "epl-club.html").read_text(encoding="utf-8")
        cls.match_js = (ROOT / "match-center-page.js").read_text(encoding="utf-8")
        cls.match_html = (ROOT / "match-center.html").read_text(encoding="utf-8")

    def test_club_fixture_links_use_real_fixture_ids(self):
        self.assertIn("f.fixture_id?", self.club_js)
        self.assertIn("match-center.html?league=Premier%20League&amp;game=", self.club_js)
        self.assertIn("encodeURIComponent(String(f.fixture_id))", self.club_js)
        self.assertIn('href="match-center.html"', self.club_js)

    def test_match_center_reads_and_selects_deep_link(self):
        self.assertIn("new URLSearchParams(location.search)", self.match_js)
        self.assertIn("params.get('game')", self.match_js)
        self.assertIn("params.get('league')", self.match_js)
        self.assertIn("choose(target.key)", self.match_js)

    def test_selected_game_updates_shareable_url(self):
        self.assertIn("url.searchParams.set('league',selected.league)", self.match_js)
        self.assertIn("url.searchParams.set('game',selected.id)", self.match_js)
        self.assertIn("history.replaceState(null,'',url)", self.match_js)

    def test_copy_button_and_clipboard_handler(self):
        self.assertRegex(self.match_html, r'id="mc-copy-link"[^>]*disabled')
        self.assertIn('id="mc-copy-feedback"', self.match_html)
        self.assertIn("navigator.clipboard.writeText(link.href)", self.match_js)
        self.assertIn("Match link copied.", self.match_js)

    def test_cache_busting_scripts(self):
        self.assertRegex(self.club_html, r'epl-club\.js\?v=\d+')
        self.assertRegex(self.match_html, r'match-center-page\.js\?v=\d+')


if __name__ == "__main__":
    unittest.main()

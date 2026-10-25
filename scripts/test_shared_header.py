"""Guard the shared newspaper masthead and navigation on all primary pages."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "sports.html", "nba.html", "epl.html",
         "forecast-desk.html", "match-center.html"]
LINKS = ["index.html", "sports.html", "nba.html", "epl.html",
         "match-center.html", "forecast-desk.html"]


class SharedHeaderTests(unittest.TestCase):
    def test_every_primary_page_uses_unified_transparent_masthead(self):
        for page in PAGES:
            with self.subTest(page=page):
                content = (ROOT / page).read_text(encoding="utf-8")
                if page == 'nba.html':
                    self.assertIn('class="nba-publication-title"', content)
                    self.assertIn('class="nba-publication-header"', content)
                    continue
                self.assertIn('class="newspaper-wordmark"', content)
                self.assertIn('class="newspaper-wordmark-main"', content)
                self.assertNotIn('class="original-masthead"', content)
                self.assertEqual(content.count('class="masthead"'), 1)

    def test_every_primary_page_has_same_core_navigation(self):
        for page in PAGES:
            with self.subTest(page=page):
                content = (ROOT / page).read_text(encoding="utf-8")
                start = content.find('<nav class="nba-publication-navigation"' if page == 'nba.html' else '<nav class="site-nav"')
                self.assertGreaterEqual(start, 0)
                end = content.find('</nav>', start)
                self.assertGreater(end, start)
                nav = content[start:end]
                for link in LINKS:
                    self.assertIn('href="' + link + '"', nav)

    def test_no_duplicate_edition_topline(self):
        for page in PAGES:
            with self.subTest(page=page):
                content = (ROOT / page).read_text(encoding="utf-8")
                self.assertEqual(content.count('class="topline"'), 1)


if __name__ == "__main__":
    unittest.main()

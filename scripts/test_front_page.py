"""Front-page editorial hierarchy and local navigation regression checks."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FrontPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = (ROOT / "index.html").read_text(encoding="utf-8")

    def test_front_page_leads_with_reporting(self):
        order = ["rabby-front", "front-page", "sports-home", "team-desk", "wire", "scores"]
        offsets = [self.page.index('<section id="' + section + '"') for section in order]
        self.assertEqual(offsets, sorted(offsets), "Editorial front page should precede model promotions")

    def test_no_empty_archive_placeholders(self):
        self.assertNotIn("PDF upload pending", self.page)
        self.assertNotIn("<main>\\n", self.page)

    def test_internal_navigation_anchors_resolve(self):
        ids = set(re.findall(r'\bid="([^"]+)"', self.page))
        for target in re.findall(r'href="#([^"]+)"', self.page):
            with self.subTest(anchor=target):
                self.assertIn(target, ids)

    def test_local_static_links_exist(self):
        for href in re.findall(r'href="([^"]+)"', self.page):
            if href.startswith(("#", "https:", "http:", "mailto:", "tel:")):
                continue
            path = href.split("?", 1)[0].split("#", 1)[0]
            if path:
                with self.subTest(href=href):
                    self.assertTrue((ROOT / path).is_file(), "Broken local file link: " + href)


if __name__ == "__main__":
    unittest.main()

"""Static contract for the coordinated Heritage Sporting Press design phase.

Run: python3 -m unittest scripts/test_cbb_heritage_press.py
These assertions do not replace browser visual QA or GitHub Pages verification.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("ncaam-team.html", "ncaaw-team.html", "ncaam-slate.html")
SHEET = "slt-cbb-heritage.css"

class HeritagePressContract(unittest.TestCase):
    def test_shared_sheet_last_and_opt_in(self):
        for page in PAGES:
            with self.subTest(page=page):
                text = (ROOT / page).read_text(encoding="utf-8")
                self.assertRegex(text, r'<body\b[^>]*class="slt-cbb-heritage"')
                self.assertEqual(text.count('href="' + SHEET + '?'), 1)
                head = text.split("</head>", 1)[0]
                self.assertIn(SHEET, head)
                self.assertTrue(head.rstrip().endswith('<link rel="stylesheet" href="' + SHEET + '?v=20261113-press1">'))
                self.assertIn("cbb-ledger-scorebug.js", text)

    def test_mens_and_womens_crest_size_share_a_rule(self):
        css = (ROOT / SHEET).read_text(encoding="utf-8")
        self.assertIn(".ledger26-scorebug", css)
        self.assertIn("--ledger26-crest-size: 56px", css)
        self.assertIn("--ledger26-crest-size: 48px", css)
        self.assertIn("--ledger26-crest-size: 40px", css)
        self.assertIn(".team-hero .mbb-mark", css)
        self.assertIn(".wbb-identity .mbb-mark", css)
        slate = (ROOT / "ncaam-slate.html").read_text(encoding="utf-8")
        self.assertNotIn("Men's Daily Ledger: larger school crests", slate)

    def test_existing_data_renderers_and_form_book_remain(self):
        men = (ROOT / "ncaam-team.html").read_text(encoding="utf-8")
        women = (ROOT / "ncaaw-team.html").read_text(encoding="utf-8")
        slate = (ROOT / "ncaam-slate.html").read_text(encoding="utf-8")
        for page in (men, women):
            self.assertIn("cbb-team-form.js", page)
            self.assertIn("mbb-logo-system.js", page)
        self.assertIn("mbb-team-calendar-boot.js", men)
        self.assertIn("wbb-team-newspaper.js", women)
        self.assertIn("ncaam-slate.js", slate)
        self.assertIn("cbb-shared-navigation.js", slate)

if __name__ == "__main__":
    unittest.main()

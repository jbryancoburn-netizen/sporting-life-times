"""Public 2026 House poll compilation is secondary evidence, never calibrated odds."""
import json
import unittest
from scripts.politics_house_poll_compilation import ROOT,parse_page

class HouseCompilationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas=json.loads((ROOT/"politics-house-atlas.json").read_text(encoding="utf-8"))

    def sample(self,records=100):
        ids=[r["id"] for r in self.atlas["districts"] if r["district"]!="00"][:records]
        lines=[
          "<li>Example state ("+rid+"): 2 polls. Newest: <a href='https://example.org/original-poll'>Original Pollster</a>, Oct 21, 2026: Example Democrat (D) 48%, Example Republican (R) 45%</li>"
          for rid in ids
        ]
        return "<!doctype html><h1>2026 House district polls</h1><ul>"+"".join(lines)+"</ul>"
    def test_extracts_nonempty_distinct_records_with_compilation_disclaimer(self):
        out=parse_page(self.sample(),self.atlas)
        self.assertEqual(out["polled_districts"],100)
        self.assertTrue(all(r["compilation_verified"] and r["source_verified"] is False for r in out["polls"]))
        self.assertTrue(all(r["sample_size"] is None and r["start_date"] is None for r in out["polls"]))
        self.assertTrue(out["polling_not_election_predictions"])
        self.assertTrue(all(r["source_url"].startswith("https://") for r in out["polls"]))
    def test_missing_release_url_and_overlapping_records_block_incomplete_publication(self):
        bad=self.sample().replace("https://example.org/original-poll","http://bad.test/poll")
        with self.assertRaises(ValueError):parse_page(bad,self.atlas)
        dupe=self.sample().replace("</ul>","<li>Example (AZ-1): 2 polls. Newest: <a href='https://example.org/poll'>Another</a>, Oct 22, 2026: Sample D (D) 48%, Sample R (R) 44%</li></ul>")
        with self.assertRaises(ValueError):parse_page(dupe,self.atlas)
    def test_2024_or_not_house_rejected(self):
        with self.assertRaises(ValueError):parse_page(self.sample().replace("2026 House district polls","2024 House district polls"),self.atlas)
    def test_year_and_percentages_cannot_be_fabricated(self):
        with self.assertRaises(ValueError):parse_page(self.sample().replace("Oct 21, 2026","Oct 21, 2025"),self.atlas)
        with self.assertRaises(ValueError):parse_page(self.sample().replace("48%, Example Republican (R) 45%","88%, Example Republican (R) 95%"),self.atlas)
if __name__=="__main__":unittest.main()

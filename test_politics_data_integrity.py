"""Static and source-data regression checks for the politics original-evidence panel.

All headline numbers come from audited JSON at display time; never from
commercial forecast snapshots, literals or fabricated race data.
"""
import json
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class OriginalDataPanelTests(unittest.TestCase):
    def test_source_json_cross_ledger(self):
        ballot=json.loads((ROOT/"politics-ballot-audit.json").read_text())
        match=json.loads((ROOT/"politics-ballot-fec-crosswalk.json").read_text())
        geo=json.loads((ROOT/"politics-geography-audit.json").read_text())
        ready=json.loads((ROOT/"politics-sim-readiness.json").read_text())
        self.assertEqual(match["candidate_records"],ballot["candidate_ballot_entries"])
        self.assertEqual(match["house_offices"],ballot["house_contests_transcribed"])
        self.assertEqual(match["senate_offices"],ballot["senate_contests_transcribed"])
        self.assertEqual(match["official_ballot_reviewed_at"],ballot["source_reviewed_at"])
        self.assertEqual(sum(match["counts"][k] for k in
                         ("unique_exact","no_exact_identity","ambiguous","party_not_mapped")),
                         match["candidate_records"])
        self.assertLessEqual(match["counts"]["matched_finance"],match["counts"]["unique_exact"])
        self.assertEqual(geo["states_checked"],50)
        self.assertEqual(geo["boundary_changed_states_count"],9)
        self.assertEqual(geo["states_with_certified_2024_presidential_vote_on_2026_districts"],0)
        self.assertEqual(ready["status"],"NOT_READY_FOR_PUBLIC_PREDICTIONS")
        self.assertEqual(ready["certified_original_probability_count"],0)

    def test_render_requires_strict_status_and_version_agreement(self):
        js=(ROOT/"politics-data-integrity.js").read_text()
        for source in ("politics-ballot-audit.json","politics-ballot-fec-crosswalk.json",
                       "politics-geography-audit.json","politics-sim-readiness.json"):
            self.assertIn(source,js)
        for check in ("x.candidate_records!==b.candidate_ballot_entries",
                      "x.official_ballot_reviewed_at!==b.source_reviewed_at",
                      "r.certified_original_probability_count!==0",
                      "g.original_2026_house_model_geography_eligible!==false",
                      "fetchJSON(",
                      "textContent",
                      "withholding the evidence totals"):
            self.assertIn(check,js)
        self.assertNotIn("innerHTML",js)

    def test_newspaper_link_and_accessibility(self):
        paper=(ROOT/"politics.html").read_text()
        ledger=(ROOT/"politics-ballots.html").read_text()
        self.assertIn('href="politics-ballots.html#evidence"',paper)
        self.assertIn('id="original-evidence-panel"',ledger)
        self.assertIn('aria-live="polite"',ledger)
        self.assertIn('src="politics-data-integrity.js',ledger)
        self.assertIn('id="evidence"',ledger)

if __name__=="__main__":
    unittest.main()

"""Guard completeness reporting for all 435 House districts without inventing evidence."""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parent
def read(name):return json.loads((ROOT/name).read_text(encoding="utf-8"))

class HouseCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a=read("politics-house-atlas.json")
        cls.f=read("politics-fec-race-index.json")
        cls.c=read("politics-census-inputs.json")
        cls.ballots=read("politics-official-ballots.json")

    def test_research_categories_exist_for_every_seat(self):
        a=self.a
        self.assertEqual(len(a["districts"]),435)
        self.assertEqual(len({x["id"] for x in a["districts"]}),435)
        self.assertEqual(len(self.c["districts"]),435)
        self.assertEqual(len(self.f["house"]),435)
        keys={"id","state","district","official_2026_candidate_snapshot",
              "district_specific_2026_polls","registered_fec_filings_2026",
              "2024_house_result_on_prior_boundaries","2026_boundaries_revised","2026_forecast"}
        for row in a["districts"]:
            self.assertTrue(keys.issubset(row),row["id"])
            self.assertIsNone(row["2026_forecast"])
        self.assertFalse(a["forecast_eligible"])
        self.assertEqual(a["certified_2026_probabilities"],0)

    def test_each_district_fec_party_breakdown_is_real_and_reconciled(self):
        by_id={x["id"]:x for x in self.a["districts"]}
        self.assertEqual(set(by_id),{x["id"] for x in self.f["house"]})
        for row in self.f["house"]:
            with self.subTest(district=row["id"]):
                self.assertEqual(sum(row["parties"].values()),row["registered_filings"])
                self.assertEqual(row["registered_filings"],by_id[row["id"]]["registered_fec_filings_2026"])
                self.assertFalse(row["final_ballot_certified"])
                self.assertGreaterEqual(row["finance_records"],0)

    def test_official_ballot_records_never_equate_to_fec_registrations(self):
        sources={x["id"]:x for x in self.ballots["sources"]}
        rows={x["id"]:x for x in self.a["districts"]}
        official={x["id"]:x for x in self.ballots["races"] if x["office"]=="H"}
        self.assertEqual(self.a["2026_official_ballot_offices"],len(official))
        for rid,r in rows.items():
            snap=r["official_2026_candidate_snapshot"]
            if rid not in official:
                self.assertIsNone(snap,rid)
            else:
                self.assertIsNotNone(snap,rid)
                self.assertIn(snap["source_id"],sources)
                self.assertEqual(snap["source_url"],sources[snap["source_id"]]["url"])
                self.assertTrue(snap["candidates"])
                self.assertEqual(snap["candidates"],official[rid]["candidates"])
            self.assertTrue(r["fec_records_are_not_qualified_nominees"])

    def test_polls_source_tiers_and_boundaries_are_explicit(self):
        d=self.a["districts"]
        self.assertEqual(self.a["2026_polled_districts"],sum(bool(x["district_specific_2026_polls"]) for x in d))
        self.assertEqual(self.a["2026_directly_checked_release_count"],sum(
            p["source_tier"]=="original_release_checked" for r in d for p in r["district_specific_2026_polls"]))
        self.assertEqual(self.a["2026_secondary_compilation_poll_count"],sum(
            p["source_tier"]=="public_compilation_not_original_checked" for r in d for p in r["district_specific_2026_polls"]))
        for r in d:
            old=r["2024_house_result_on_prior_boundaries"]
            if old and r["2026_boundaries_revised"]:
                self.assertFalse(old["same_2026_geography"],r["id"])
            for p in r["district_specific_2026_polls"]:
                self.assertIn(p["source_tier"],{"original_release_checked","public_compilation_not_original_checked"})
                if p["source_tier"]=="public_compilation_not_original_checked":
                    self.assertIsNone(p["sample_size"])
                    self.assertFalse(p["source_verified"])

    def test_the_same_sections_exist_across_all_page_templates(self):
        for path in ["politics-house.html","politics-house-state.html","politics-house-district.html"]:
            html=(ROOT/path).read_text(encoding="utf-8")
            self.assertEqual(html.count('id="coverage-board"'),1,path)
            self.assertIn("politics-house.js",html)
        html=(ROOT/"politics-house-district.html").read_text(encoding="utf-8")
        self.assertIn('id="fec-panel"',html)
        script=(ROOT/"politics-house.js").read_text(encoding="utf-8")
        self.assertIn("showCoverage(a.districts",script)
        self.assertIn("showCoverage(rows",script)
        self.assertIn('showCoverage([r],"district")',script)
        self.assertIn("renderFEC(r);",script)
        self.assertIn("FEC registration records",script)
        self.assertIn("Certified 2026 district forecasts",script)

if __name__=="__main__":unittest.main()

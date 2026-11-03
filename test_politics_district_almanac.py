"""Protect nationwide historical-source coverage and the shared district almanac."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
def read(name):
    return (ROOT / name).read_text(encoding="utf-8")
def load(name):
    return json.loads(read(name))

class DistrictAlmanac(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas=load("politics-house-atlas.json")
        cls.recent=load("politics-historical-contests.json")
        cls.early=load("politics-historical-archive.json")
        cls.census=load("politics-census-inputs.json")
        cls.communities=load("data/politics-district-communities.json")
        cls.html=read("politics-house-district.html")
        cls.js=read("politics-district-almanac.js")
        cls.css=read("politics-district-almanac.css")

    def test_all_districts_have_almanac_data_sources(self):
        atlas={r["id"] for r in self.atlas["districts"]}
        census={r["id"] for r in self.census["districts"]}
        places=set(self.communities["districts"])
        self.assertEqual(len(atlas),435)
        self.assertEqual(atlas,census)
        self.assertEqual(atlas,places)
        for district in self.atlas["districts"]:
            local=self.communities["districts"][district["id"]]
            self.assertTrue(local.get("communities") or local.get("neighborhoods"),district["id"])

    def test_house_history_has_year_specific_votes(self):
        ids={r["id"] for r in self.atlas["districts"]}
        year_map={}
        for row in self.early["house"]+self.recent["house"]:
            self.assertIn(row["id"],ids)
            self.assertIn(row["year"],(2012,2014,2016,2018,2020,2022,2024))
            key=(row["id"],row["year"])
            self.assertNotIn(key,year_map)
            year_map[key]=row
            for field in ("dem_votes","rep_votes","other_votes"):
                self.assertGreaterEqual(row[field],0)
            self.assertTrue(row.get("source_url") or row.get("source"))
        self.assertGreaterEqual(len(year_map),3000)
        self.assertGreaterEqual(sum(sum((id_,year) in year_map for year in (2012,2014,2016,2018,2020,2022,2024))==7 for id_ in ids),413)

    def test_top_two_candidate_results_not_mislabeled_as_one_party_races(self):
        atlas={x["id"]:x for x in self.atlas["districts"]}
        candidates=atlas["CA-12"]["2024_house_result_on_prior_boundaries"]["finalists"]
        self.assertEqual(len(candidates),2)
        self.assertEqual([x["name"] for x in candidates],["Lateefah Simon","Jennifer Tran"])
        self.assertEqual([x["party"] for x in candidates],["D","D"])
        self.assertIn("finalists",self.js)
        self.assertIn("candidate_vote_source_url",self.js)

    def test_current_district_vintage_not_assumed(self):
        atlas={x["id"]:x for x in self.atlas["districts"]}
        self.assertTrue(atlas["FL-07"]["2024_to_2026_same_geography_verified"])
        self.assertFalse(atlas["FL-22"]["2024_to_2026_same_geography_verified"])
        for text in ("2010 MAP ERA","2020 MAP ERA","boundary","geography"):
            self.assertIn(text,self.js)
        self.assertIn("2026",self.js)
        self.assertNotIn("2026 winner probability",self.js)

    def test_front_end_is_wired_and_accessible(self):
        self.assertIn('id="district-almanac"',self.html)
        self.assertIn('href="#district-almanac"',self.html)
        self.assertIn('politics-district-almanac.js?',self.html)
        self.assertIn('politics-district-almanac.css?',self.html)
        self.assertIn('role","img"',self.js)
        self.assertIn("aria-label",self.js)
        self.assertIn("@media(max-width:470px)",self.css)
        self.assertIn("IntersectionObserver",self.js)
        self.assertIn("politics-historical-archive.json",self.js)
        self.assertIn("politics-historical-contests.json",self.js)

if __name__=="__main__":
    unittest.main()

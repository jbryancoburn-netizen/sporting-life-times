"""House District Almanac: data integrity and visible wiring regression test.

This test uses only local repository files and Python standard library.
"""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def get(path): return json.loads((ROOT/path).read_text(encoding="utf-8"))
class Almanac(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.data=get("data/politics-district-dossiers.json")
  cls.atlas=get("politics-house-atlas.json")
  cls.html=(ROOT/"politics-house-district.html").read_text(encoding="utf-8")
  cls.js=(ROOT/"politics-district-factbook.js").read_text(encoding="utf-8")
  cls.css=(ROOT/"politics-district-factbook.css").read_text(encoding="utf-8")
 def test_every_district_has_its_own_record(self):
  ids={x["id"] for x in self.atlas["districts"]}
  self.assertEqual(len(ids),435)
  self.assertEqual(self.data["district_count"],435)
  self.assertEqual(set(self.data["districts"]),ids)
  self.assertTrue(all(x["id"]==id for id,x in self.data["districts"].items()))
 def test_historical_source_coverage_and_time_era(self):
  rows=sum(len(r["history"]) for r in self.data["districts"].values())
  self.assertEqual(rows,2986)
  for id,d in self.data["districts"].items():
   years=[r["year"] for r in d["history"]]
   self.assertEqual(years,sorted(set(years),reverse=True),id)
   for r in d["history"]:
    self.assertEqual(r["historical_vintage"],"2010_apportionment_era" if r["year"]<=2020 else "2020_apportionment_era")
    self.assertTrue(str(r.get("source_url","")).startswith("https://"),(id,r["year"]))
    if r.get("finalists"):
     self.assertEqual(len(r["finalists"]),2,id)
     self.assertEqual(r["finalist_gap_votes"],r["finalists"][0]["votes"]-r["finalists"][1]["votes"],id)
 def test_same_party_general_elections_are_not_unopposed(self):
  records=self.data["districts"]
  for id in ("CA-12","CA-16","CA-20","CA-34","WA-04","WA-09"):
   h=records[id]["history"][0]
   self.assertEqual(h["year"],2024)
   self.assertEqual(h["finalists"][0]["party"],h["finalists"][1]["party"])
   self.assertFalse(h["contested_major_parties"])
   self.assertIsNone(h["two_party_margin_pp"])
  self.assertEqual(records["CA-12"]["history"][0]["finalists"][1]["name"],"Jennifer Tran")
 def test_geographic_florida_not_state_assumption(self):
  records=self.data["districts"]
  for id in ("FL-01","FL-02","FL-04","FL-05","FL-07"):
   self.assertEqual(records[id]["geography"]["status_2024_2026"],"verified_same_district_blocks")
  self.assertEqual(records["FL-22"]["geography"]["status_2024_2026"],"verified_changed_district_blocks")
  self.assertEqual(records["CA-12"]["geography"]["status_2024_2026"],"pending_district_block_comparison")
 def test_census_coverage_and_sources(self):
  for id,row in self.data["districts"].items():
   self.assertIsNotNone(row["census"],id)
   for key in ("residents","median_income","bachelors_pct"):
    self.assertEqual(row["census"]["ranks"][key]["of"],435,id)
 def test_actual_page_shows_new_component(self):
  self.assertEqual(self.html.count('id="district-factbook"'),1)
  self.assertIn('politics-district-factbook.js',self.html)
  self.assertIn('politics-district-factbook.css',self.html)
  self.assertIn('data/politics-district-dossiers.json',self.js)
  self.assertIn("d.history.forEach",self.js)
  self.assertIn("@media(max-width:760px)",self.css)
if __name__=="__main__":unittest.main()

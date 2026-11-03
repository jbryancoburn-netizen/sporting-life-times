"""Regression test: the published House district almanac must be source-checked and nationwide.

Run: python -m unittest test_politics_district_dossiers
No paid service or browser is needed for the archive integrity tests.
"""
import json
import unittest
from pathlib import Path
from scripts.build_politics_district_dossiers import build

ROOT=Path(__file__).resolve().parent
class DistrictDossier(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.d=json.loads((ROOT/"data"/"politics-district-dossiers.json").read_text(encoding="utf-8"))
  cls.ids=cls.d["districts"]
 def test_all_435_districts_have_sourced_data(self):
  self.assertEqual(self.d["schema_version"],1)
  self.assertEqual(self.d["district_count"],435)
  self.assertEqual(len(self.ids),435)
  self.assertEqual(sum(bool(v["census"]) for v in self.ids.values()),435)
  self.assertEqual(sum(len(v["history"]) for v in self.ids.values()),2986)
  self.assertEqual(sum(len(v["history"])==7 for v in self.ids.values()),413)
  for id_,row in self.ids.items():
   self.assertEqual(row["id"],id_)
   self.assertEqual(len(row["missing_years"])+len(row["history"]),7)
   for result in row["history"]:
    self.assertTrue(result["source_url"].startswith("https://"),(id_,result["year"]))
    self.assertIn(result["historical_vintage"],("2010_apportionment_era","2020_apportionment_era"))
    self.assertFalse(result["archive_certified"])
 def test_same_party_elections_are_not_fake_unopposed_margins(self):
  r=self.ids["CA-12"]["history"][0]
  self.assertEqual(r["year"],2024)
  self.assertEqual(r["finalist_gap_votes"],87327)
  self.assertEqual([p["party"] for p in r["finalists"]],["D","D"])
  self.assertIsNone(r["two_party_margin_pp"])
  self.assertEqual(r["finalists"][0]["name"],"Lateefah Simon")
  self.assertEqual(self.ids["WA-09"]["history"][0]["finalists"][1]["name"],"Melissa Chaudhry")
 def test_fl_boundaries_district_by_district(self):
  unchanged={"FL-01","FL-02","FL-04","FL-05","FL-07"}
  for code in range(1,29):
   id_="FL-%02d"%code
   row=self.ids[id_]
   status=row["geography"]["status_2024_2026"]
   self.assertEqual(status,"verified_same_district_blocks" if id_ in unchanged else "verified_changed_district_blocks")
   self.assertIsNotNone(row["geography"]["blocks"])
  self.assertEqual(self.ids["CA-12"]["geography"]["status_2024_2026"],"pending_district_block_comparison")
 def test_rankings_have_correct_denominators(self):
  r=self.ids["FL-07"]["census"]
  self.assertEqual(r["population"],789605)
  self.assertEqual(r["median_income"] if "median_income" in r else r["income"],81536)
  for key in ("residents","median_income","bachelors_pct"):
   rank=r["ranks"][key]
   self.assertEqual(rank["of"],435)
   self.assertLessEqual(rank["state_rank"],rank["state_total"])
 def test_rebuild_source_does_not_lag_published_record(self):
  current=build()
  self.assertEqual(len(current["districts"]),435)
  self.assertEqual(sum(len(x["history"]) for x in current["districts"].values()),2986)
  for id_ in ("IA-01","CA-12","FL-07","FL-22","WA-09"):
   a=self.ids[id_];b=current["districts"][id_]
   self.assertEqual([x["year"] for x in a["history"]],[x["year"] for x in b["history"]])
   self.assertEqual(a["geography"],b["geography"])
   self.assertEqual(a["census"]["ranks"],b["census"]["ranks"])
if __name__=="__main__":
 unittest.main()

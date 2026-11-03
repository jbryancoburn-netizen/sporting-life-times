"""435-district election-history release gate: source checks, vintage separation and no fake same-party margins."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

def data(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))

class DistrictHistory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas=data("politics-house-atlas.json")
        cls.history=data("politics-historical-contests.json")
        cls.census=data("politics-census-inputs.json")
        cls.communities=data("data/politics-district-communities.json")
        cls.d={r["id"]:r for r in cls.atlas["districts"]}
        cls.y={(r["id"],r["year"]):r for r in cls.history["house"]}

    def test_all_435_have_district_specific_source_data(self):
        self.assertEqual(len(self.d),435)
        self.assertEqual(set(self.d),{x["id"] for x in self.census["districts"]})
        self.assertEqual(set(self.d),set(self.communities["districts"]))
        self.assertGreaterEqual(sum((id,2022) in self.y for id in self.d),400)
        self.assertEqual(sum(bool(x.get("2024_house_result_on_prior_boundaries")) for x in self.d.values()),433)

    def test_same_party_elections_preserve_both_real_finalists(self):
        for id in ["CA-12","CA-16","CA-20","CA-34","WA-04","WA-09"]:
            h=self.d[id]["2024_house_result_on_prior_boundaries"]
            self.assertEqual(len(h["finalists"]),2,id)
            self.assertEqual(h["finalists"][0]["party"],h["finalists"][1]["party"],id)
            self.assertIsNone(h["dem_two_party_margin_pp"],id)
            self.assertEqual(h["winner_runner_up_margin_votes"],h["finalists"][0]["votes"]-h["finalists"][1]["votes"],id)

    def test_district_not_state_geographic_assumptions(self):
        for id in ["FL-01","FL-02","FL-04","FL-05","FL-07"]:
            self.assertEqual(self.d[id]["2024_to_2026_geography_comparison"],"verified_same_district_blocks")
            self.assertTrue(self.d[id]["2024_to_2026_same_geography_verified"])
        self.assertEqual(self.d["FL-22"]["2024_to_2026_geography_comparison"],"verified_changed_district_blocks")
        self.assertFalse(self.d["CA-12"]["2024_to_2026_same_geography_verified"])
        self.assertEqual(self.d["CA-12"]["2024_to_2026_geography_comparison"],"pending_district_block_comparison")

    def test_2022_2024_comparison_only_where_safe(self):
        for id,record in self.d.items():
            if record["2022_to_2024_geography_comparison"]=="pending_district_vintage_audit":
                self.assertIn(record["state"],{"AL","GA","LA","NY","NC"})
        ia=self.d["IA-01"]["2024_house_result_on_prior_boundaries"]
        h22=self.y[("IA-01",2022)]
        self.assertEqual(abs(ia["dem_votes"]-ia["rep_votes"]),799)
        self.assertAlmostEqual(ia["dem_two_party_margin_pp"]-h22["two_party_margin"],6.62,delta=.06)

    def test_all_pages_include_source_date_aware_history(self):
        html=(ROOT/"politics-house-district.html").read_text()
        js=(ROOT/"politics-district-guide.js").read_text()
        mast=(ROOT/"politics-district-editorial-v4.js").read_text()
        self.assertIn("politics-historical-contests.json",js)
        self.assertIn("dossier-history",html)
        self.assertIn("SAME-PARTY",js)
        self.assertIn("2022_to_2024_geography_comparison",js)
        self.assertIn("2024_to_2026_geography_comparison",mast)
        self.assertNotIn("Math.random",js)

if __name__=="__main__":
    unittest.main()

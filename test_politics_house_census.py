"""Census demographic panels must use the original 119th district vintage, not vote proxies."""
import json
import pathlib
import unittest
ROOT=pathlib.Path(__file__).resolve().parent

class HouseCensusUITests(unittest.TestCase):
    def test_all_435_original_census_district_rows_have_geography_warning(self):
        d=json.loads((ROOT/"politics-census-inputs.json").read_text())
        self.assertEqual(d["status"],"ok")
        self.assertEqual(d["district_count"],435)
        self.assertEqual(len({x["id"] for x in d["districts"]}),435)
        self.assertEqual(len({x["state"] for x in d["districts"]}),50)
        self.assertTrue(d["geography"].startswith("119th Congress"))
        self.assertIs(d["2026_district_geography_harmonized"],False)
        self.assertIs(d["forecast_eligible"],False)
        self.assertTrue(all(x["boundary_vintage"]=="119th_Congress_2024" for x in d["districts"]))
        self.assertTrue(all(x["geographically_usable_as_2026_population"] is False for x in d["districts"]))
    def test_changed_map_states_cannot_be_treated_as_2026_demographics(self):
        d=json.loads((ROOT/"politics-census-inputs.json").read_text())
        for x in d["districts"]:
            self.assertEqual(x["2026_boundary_change_requires_remap"],
                x["state"] in {"AL","CA","FL","LA","NC","OH","TN","TX","UT"})
        fl=next(x for x in d["districts"] if x["id"]=="FL-22")
        self.assertEqual(fl["population_2020_2024_acs_est"],786471)
        self.assertEqual(fl["median_household_income_est"],81071)
    def test_demographic_data_is_on_individual_district_page_only(self):
        html=(ROOT/"politics-house-district.html").read_text()
        self.assertIn("politics-house-census.js",html)
        self.assertIn("politics-house-census.css",html)
        self.assertIn('data-house-page="district"',html)
        js=(ROOT/"politics-house-census.js").read_text()
        self.assertIn('data.housePage!=="district"',js)
        self.assertIn("2026_boundary_change_requires_remap",js)
        self.assertIn("2026_district_geography_harmonized",js)
        self.assertIn("population_moe_est",js)
        self.assertIn("median_household_income_moe_est",js)
        self.assertIn("margin of error not calculated",js)
        self.assertIn("source_files",js)
        self.assertNotIn(".innerHTML",js)
        self.assertNotIn("win_probability",js)
    def test_only_official_census_source_links(self):
        data=json.loads((ROOT/"politics-census-inputs.json").read_text())
        self.assertEqual(set(data["source_files"]),{"B01003","B19013","B15003"})
        for v in data["source_files"].values():
            self.assertTrue(v["url"].startswith("https://www2.census.gov/programs-surveys/acs/summary_file/2024/"))
            self.assertEqual(len(v["sha256"]),64)
if __name__=="__main__":unittest.main()

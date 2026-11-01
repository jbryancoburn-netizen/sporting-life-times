"""435 state/district pages: original voting evidence, no guessed 2026 winner."""
import copy
import json
import unittest
from scripts.politics_house_atlas import ROOT,build,STATES,MAP_CHANGED

class HouseAtlasTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inputs=[
            json.loads((ROOT/name).read_text(encoding="utf-8"))
            for name in ("politics-fec-race-index.json","politics-historical-contests.json",
                         "politics-2024-county-presidential.json","politics-official-ballots.json",
                         "politics-2026-district-geography.json","politics-data.json",
                         "politics-house-district-polls.json")
        ]

    def test_all_435_unique_pages_and_50_states(self):
        output=build(*self.inputs)
        self.assertEqual(output["district_count"],435)
        self.assertEqual(output["state_count"],50)
        self.assertEqual(sum(s["district_count"] for s in output["states"]),435)
        self.assertEqual(len({r["id"] for r in output["districts"]}),435)
        self.assertEqual({s["code"] for s in output["states"]},STATES)
        self.assertFalse(output["forecast_eligible"])
        self.assertEqual(output["certified_2026_probabilities"],0)

    def test_2024_state_presidential_margin_not_2026_forecast(self):
        output=build(*self.inputs)
        az=next(x for x in output["states"] if x["code"]=="AZ")
        self.assertLess(az["2024_presidential_actual"]["dem_margin_pp"],0)
        self.assertGreater(az["2024_presidential_actual"]["rep_votes"],az["2024_presidential_actual"]["dem_votes"])
        self.assertNotIn("2026_predicted_winner",az)

    def test_2026_boundary_change_guards(self):
        output=build(*self.inputs)
        fl=next(r for r in output["districts"] if r["id"]=="FL-22")
        self.assertTrue(fl["2026_boundaries_revised"])
        self.assertFalse(fl["2024_house_result_on_prior_boundaries"]["same_2026_geography"])
        az=next(r for r in output["districts"] if r["id"]=="AZ-01")
        self.assertFalse(az["2026_boundaries_revised"])
        self.assertTrue(az["2024_house_result_on_prior_boundaries"]["same_2026_geography"])
        self.assertEqual(set(output["2026_changed_map_states"]),MAP_CHANGED)

    def test_campaign_registrations_are_not_ballot_candidates(self):
        output=build(*self.inputs)
        districts=[r for r in output["districts"] if r["official_2026_candidate_snapshot"] is None]
        self.assertTrue(districts)
        self.assertTrue(all(r["fec_records_are_not_qualified_nominees"] for r in districts))
        self.assertTrue(all(r["2026_forecast"] is None for r in output["districts"]))

    def test_seven_original_poll_records_are_not_probabilities(self):
        output=build(*self.inputs)
        az=next(r for r in output["districts"] if r["id"]=="AZ-01")
        p=az["district_specific_2026_polls"][0]
        self.assertEqual(p["pollster"],"Keating Research")
        self.assertEqual({x["party"]:x["pct"] for x in p["candidates"]},{"D":49,"R":45})
        self.assertEqual(output["2026_polled_districts"],7)
        self.assertNotIn("win_probability",p)

    def test_fake_poll_without_2026_primary_source_rejected(self):
        inputs=copy.deepcopy(self.inputs)
        inputs[-1]["polls"][0]["source_verified"]=False
        with self.assertRaises(ValueError):build(*inputs)

    def test_historical_missing_records_remain_empty(self):
        output=build(*self.inputs)
        self.assertEqual(len(output["2024_house_result_missing_districts"]),435-output["2024_house_results_found"])
        for rid in output["2024_house_result_missing_districts"]:
            self.assertIsNone(next(r for r in output["districts"] if r["id"]==rid)["2024_house_result_on_prior_boundaries"])

    def test_duplicate_fec_district_rejected(self):
        inputs=copy.deepcopy(self.inputs)
        inputs[0]["house"].append(copy.deepcopy(inputs[0]["house"][0]))
        with self.assertRaises(ValueError):build(*inputs)

    def test_geography_not_inherited_by_renaming(self):
        inputs=copy.deepcopy(self.inputs)
        inputs[4]["official_2026_boundary_change_states"].remove("FL")
        with self.assertRaises(ValueError):build(*inputs)

if __name__=="__main__":unittest.main()

"""Verify no stale 2024 district vote is silently relabeled as a 2026 district."""
import copy
import json
import unittest
from scripts.politics_geography_guard import ROOT,validate,REVISED

class DistrictVintageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/"politics-2026-district-geography.json").read_text())

    def test_census_boundary_states_and_missouri(self):
        r=validate(self.data)
        self.assertEqual(r["states_checked"],50)
        self.assertEqual(r["boundary_changed_states"],sorted(REVISED))
        self.assertTrue(r["missouri_2026_boundary_remains_2024"])
        self.assertFalse(r["original_2026_house_model_geography_eligible"])
        self.assertEqual(r["states_with_certified_2024_presidential_vote_on_2026_districts"],0)

    def test_2024_district_ids_cannot_be_inherited(self):
        x=copy.deepcopy(self.data)
        next(r for r in x["states"] if r["state"]=="FL")["verified_2024_presidential_vote_retabulated_on_2026_house_districts"]=True
        with self.assertRaises(ValueError):validate(x)

    def test_missouri_old_gis_file_is_not_trusted(self):
        x=copy.deepcopy(self.data)
        x["missouri_special_case"]["uses_2024_congressional_boundaries_in_2026"]=False
        with self.assertRaises(ValueError):validate(x)

    def test_wrong_map_vintage_cannot_be_used(self):
        x=copy.deepcopy(self.data)
        x["election_district_vintage"]="119th_Congress"
        with self.assertRaises(ValueError):validate(x)

    def test_census_registry_requires_all_50_states(self):
        x=copy.deepcopy(self.data)
        x["states"].pop()
        with self.assertRaises(ValueError):validate(x)

    def test_no_fabricated_votes_or_probabilities(self):
        x=copy.deepcopy(self.data)
        x["forecast_eligible"]=True
        with self.assertRaises(ValueError):validate(x)
if __name__=="__main__":unittest.main()

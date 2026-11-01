"""Offline tests: county returns are never silently turned into 2026 district estimates."""
import datetime as dt
import unittest
from scripts.politics_presidential_counties import normalize,party,numeric,STATES

def row(state="FL",unit="12001",candidate="Candidate D",affiliation="DEMOCRAT",votes=700):
    return {"year":2024,"state_po":state,"unit_id":unit,"county_name":"Example County",
            "county_fips":unit,"candidate":candidate,"party":affiliation,
            "candidatevotes":votes,"totalvotes":1000}

def synthetic():
    rows=[]
    for i,state in enumerate(sorted(STATES)):
        unit=f"{i:05d}"
        rows.append(row(state,unit,"A","DEMOCRAT",600))
        rows.append(row(state,unit,"B","REPUBLICAN",400))
    return rows

class CountyTests(unittest.TestCase):
    def test_party_labels(self):
        self.assertEqual(party("DEMOCRAT"),"D")
        self.assertEqual(party("REPUBLICAN"),"R")
        self.assertEqual(party("LIBERTARIAN"),"O")
        self.assertIsNone(numeric(-1))
    def test_county_state_aggregates_and_explicit_nonforecast(self):
        obj=normalize({"rows":synthetic()},now=dt.datetime(2026,11,1,tzinfo=dt.timezone.utc),min_counties=51,min_voters=50000)
        self.assertEqual(obj["state_count"],51)
        self.assertEqual(obj["county_count"],51)
        self.assertEqual(obj["two_party_votes"],51000)
        self.assertEqual(obj["states"][0]["dem_two_party_share"],0.6)
        self.assertEqual(obj["counties"][0]["dem_margin_pp"],20.0)
        self.assertFalse(obj["certified_for_2026_house_forecast"])
        self.assertEqual(obj["geography"],"county_or_equivalent_not_congressional_district")
        self.assertNotIn("district_votes",obj["counties"][0])
    def test_rejects_false_national_completeness(self):
        with self.assertRaises(ValueError):
            normalize({"rows":synthetic()[:-2]},min_counties=51,min_voters=50000)
    def test_duplicate_candidate_does_not_double_count(self):
        rows=synthetic()
        rows.append(dict(rows[0]))
        obj=normalize({"rows":rows},min_counties=51,min_voters=50000)
        self.assertEqual(obj["two_party_votes"],51000)
        self.assertEqual(obj["excluded_rows"]["duplicate_candidate_party_unit"],1)
    def test_invalid_votes_are_not_fabricated(self):
        rows=synthetic()
        rows[0]["candidatevotes"]=None
        obj=normalize({"rows":rows},min_counties=51,min_voters=50000)
        self.assertEqual(obj["two_party_votes"],50400)
        self.assertEqual(obj["excluded_rows"]["invalid_candidate_votes"],1)
if __name__=="__main__":unittest.main()

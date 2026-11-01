"""FEC registrations are never certified as a final ballot or 2026 Senate race."""
import unittest
from scripts.politics_fec_race_index import build
class FECRaceIndexTests(unittest.TestCase):
    def test_435_house_districts_without_fabricating_ballot_candidates(self):
        candidate={"id":"H6FL01001","state":"FL","district":"01","office":"H",
                   "party":"DEM","incumbency_fec":"I","finance":None}
        filler=[]
        for i in range(299):
            filler.append({"id":f"H6CA{i:05d}","state":"CA","district":"01",
                           "office":"H","party":"REP","incumbency_fec":"C","finance":None})
        d=build({"status":"ok","cycle":2026,"candidates":[candidate]+filler})
        self.assertEqual(d["house_district_inventory"],435)
        self.assertEqual(len(d["house"]),435)
        self.assertEqual(d["ballot_verified_districts"],0)
        self.assertFalse(d["forecast_eligible"])
        self.assertTrue(all(c["final_ballot_certified"] is False for c in d["house"]))
        district=next(c for c in d["house"] if c["id"]=="FL-01")
        self.assertEqual(district["registered_filings"],1)
        self.assertEqual(district["incumbent_filing_ids"],["H6FL01001"])
    def test_invalid_filing_district_excluded_not_as_candidate(self):
        rows=[{"id":f"H6TX{i:05d}","state":"TX","district":"99","office":"H","party":"REP","finance":None} for i in range(300)]
        d=build({"status":"ok","cycle":2026,"candidates":rows})
        self.assertEqual(d["filing_exclusions"]["invalid_house_district_for_2020_apportionment"],300)
        self.assertEqual(d["house_districts_with_registrations"],0)
        self.assertEqual(d["ballot_verified_districts"],0)
    def test_does_not_claim_all_senate_states_are_electing(self):
        rows=[{"id":f"S6FL{i:05d}","state":"FL","district":"00","office":"S","party":"DEM","finance":None} for i in range(300)]
        d=build({"status":"ok","cycle":2026,"candidates":rows})
        self.assertEqual(len(d["senate"]),50)
        self.assertEqual(d["senate_states_with_registrations"],1)
        self.assertIn("does not establish",d["senate"][0]["note"])
if __name__=="__main__":unittest.main()

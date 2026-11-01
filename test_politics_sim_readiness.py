"""Simulation readiness must never treat filing rolls as ballots or a model as certified."""
import unittest
from scripts.politics_sim_readiness import build
class ReadinessTests(unittest.TestCase):
    def test_empty_not_forecast_ready(self):
        d=build({})
        self.assertEqual(d["status"],"NOT_READY_FOR_PUBLIC_PREDICTIONS")
        self.assertFalse(d["house_forecast_ready"])
        self.assertEqual(d["counts"]["missing"],13)
        self.assertEqual(d["certified_original_probability_count"],0)
    def test_even_full_primary_data_does_not_certify_forecast(self):
        d=build({
            "history":{"winner_party_totals_reconciled":True},
            "row":{"status":"ok","house":[{"id":str(n)} for n in range(1730)],"senate":[{"id":str(n)} for n in range(130)]},
            "fec":{"status":"ok","house_count":1100,"senate_count":110,"candidates":[{"id":str(n)} for n in range(1210)],"finance_records_joined":500},
            "census":{"status":"ok","districts":[{"id":str(n)} for n in range(435)]},
            "polling":{"status":"ok"},
            "poll_audit":{"eligible_polls":7,"unique_pollsters":4}})
        self.assertEqual(d["counts"]["verified"],1)
        self.assertFalse(d["senate_forecast_ready"])
        self.assertFalse(d["governor_forecast_ready"])
        self.assertEqual(d["certified_original_probability_count"],0)
        self.assertTrue(any(x["id"]=="2026_official_general_election_ballot_roster" and x["state"]=="missing" for x in d["checks"]))
if __name__=="__main__":unittest.main()

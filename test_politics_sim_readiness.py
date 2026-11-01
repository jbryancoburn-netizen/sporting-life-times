"""Simulation readiness must never treat filing rolls as ballots or a model as certified."""
import unittest
from scripts.politics_sim_readiness import build
class ReadinessTests(unittest.TestCase):
    def test_empty_not_forecast_ready(self):
        d=build({})
        self.assertEqual(d["status"],"NOT_READY_FOR_PUBLIC_PREDICTIONS")
        self.assertFalse(d["house_forecast_ready"])
        self.assertEqual(d["counts"]["missing"],17)
        self.assertEqual(d["certified_original_probability_count"],0)
    def test_historical_archive_still_ineligible_for_live_forecast(self):
        d=build({"archive":{"status":"ok","house":[{"id":str(i)} for i in range(1300)],
                             "senate":[{"id":str(i)} for i in range(80)]}})
        archive=next(x for x in d["checks"] if x["id"]=="2012_2016_historical_source_archive")
        self.assertEqual(archive["state"],"partial")
        self.assertFalse(d["house_forecast_ready"])

    def test_2000_archive_does_not_certify_house_forecast(self):
        d=build({"deep_history":{"status":"ok","house":[{"id":str(i)} for i in range(2600)],"senate":[{"id":str(i)} for i in range(195)]}})
        item=next(x for x in d["checks"] if x["id"]=="2000_2010_original_election_archive")
        self.assertEqual(item["state"],"partial")
        self.assertFalse(d["house_forecast_ready"])

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
    def test_attribution_and_join_status_follow_current_state_sources(self):
        original={
          "ballot_audit":{
            "status":"PARTIAL_GOVERNMENT_SOURCE_BALLOTS_VALIDATED",
            "all_435_house_races_covered":False,
            "certified_2026_probability_count":0,
            "house_contests_transcribed":51,
            "house_general_ballot_contests_transcribed":50,
            "unopposed_offices_without_general_ballot":["FL-10"],
            "senate_contests_transcribed":3,
            "house_contests_unverified":384,
            "candidate_ballot_entries":156,
            "source_reviewed_at":"2026-11-01",
            "state_coverage":{"FL":{},"NC":{},"MD":{},"WY":{}}
          },
          "fec_crosswalk":{
            "status":"EXACT_JOIN_DIAGNOSTIC_ONLY",
            "forecast_eligible":False,
            "candidate_records":156,
            "official_ballot_reviewed_at":"2026-11-01",
            "certified_2026_probability_count":0,
            "counts":{"unique_exact":76}
          }
        }
        d=build(original)
        c=next(x for x in d["checks"] if x["id"]=="2026_official_general_election_ballot_roster")
        self.assertEqual(c["state"],"partial")
        self.assertEqual(c["verified_record_count"],54)
        self.assertIn("FL, MD, NC, WY",c["source"])
        self.assertIn("76 original FEC candidate IDs",c["blocker"])
        self.assertFalse(d["house_forecast_ready"])
        self.assertEqual(d["certified_original_probability_count"],0)

    def test_stale_fec_crosswalk_cannot_get_credited(self):
        a={"status":"PARTIAL_GOVERNMENT_SOURCE_BALLOTS_VALIDATED",
           "all_435_house_races_covered":False,"certified_2026_probability_count":0,
           "house_contests_transcribed":51,"senate_contests_transcribed":3,
           "source_reviewed_at":"2026-11-01","candidate_ballot_entries":156,
           "state_coverage":{"MD":{}}}
        crosswalk={"status":"EXACT_JOIN_DIAGNOSTIC_ONLY","forecast_eligible":False,
                   "candidate_records":134,"official_ballot_reviewed_at":"2026-10-01",
                   "certified_2026_probability_count":0,"counts":{"unique_exact":67}}
        d=build({"ballot_audit":a,"fec_crosswalk":crosswalk})
        c=next(x for x in d["checks"] if x["id"]=="2026_official_general_election_ballot_roster")
        self.assertIn("crosswalk is incomplete or out of sync",c["blocker"])
        self.assertNotIn("67 original FEC",c["blocker"])

if __name__=="__main__":unittest.main()

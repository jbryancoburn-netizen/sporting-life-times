"""Safety and source-fidelity checks for primary-source ballot review."""
import copy
import json
import unittest
from scripts.politics_ballot_audit import ROOT, validate

class BallotAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = json.loads((ROOT / "politics-official-ballots.json").read_text())

    def test_actual_official_seed_coverage_without_forecast_permission(self):
        result = validate(self.ledger)
        self.assertEqual(result["house_contests_transcribed"], 51)
        self.assertEqual(result["senate_contests_transcribed"], 3)
        self.assertEqual(result["candidate_ballot_entries"], 156)
        self.assertTrue(result["state_coverage"]["NC"]["full_house_snapshot"])
        self.assertTrue(result["state_coverage"]["FL"]["full_house_snapshot"])
        self.assertEqual(result["certified_2026_probability_count"], 0)
        self.assertEqual(result["house_contests_unverified"], 435-result["house_contests_transcribed"])
        self.assertEqual(result["state_coverage"]["FL"]["house"], 28)
        self.assertEqual(result["state_coverage"]["WY"]["house"], 1)
        self.assertTrue(result["state_coverage"]["WY"]["full_house_snapshot"])
        self.assertEqual(result["florida_unverified_districts"], [])
        self.assertEqual(result["qualified_write_in_entries_not_printed_on_ballot"], 12)
        self.assertEqual(result["unopposed_offices_without_general_ballot"], ["FL-10"])
        self.assertEqual(result["house_general_ballot_contests_transcribed"], 50)
        self.assertEqual(result["state_coverage"]["MD"]["house"], 8)
        self.assertEqual(result["state_coverage"]["MD"]["senate"], 0)
        self.assertTrue(result["state_coverage"]["MD"]["full_house_snapshot"])
        self.assertEqual(self.ledger["races"][[r["id"] for r in self.ledger["races"]].index("FL-10")]["candidates"][0]["name"], "Maxwell Alejandro Frost")
        self.assertFalse(result["all_435_house_races_covered"])

    def test_no_duplicate_race(self):
        d = copy.deepcopy(self.ledger)
        d["races"].append(copy.deepcopy(d["races"][0]))
        with self.assertRaises(ValueError):
            validate(d)

    def test_not_transcribed_source_cannot_supply_fake_races(self):
        d = copy.deepcopy(self.ledger)
        fake = copy.deepcopy(d["races"][0])
        fake.update(id="CA-01",state="CA",district="01",office="H",source_id="CA_SOS_2026_GENERAL")
        d["races"].append(fake)
        with self.assertRaises(ValueError):
            validate(d)

    def test_private_data_fields_rejected(self):
        d = copy.deepcopy(self.ledger)
        d["races"][0]["candidates"][0]["address"] = "not needed"
        with self.assertRaises(ValueError):
            validate(d)

    def test_no_premature_fec_matching_or_probabilities(self):
        d = copy.deepcopy(self.ledger)
        d["races"][0]["fec_identity_match_certified"] = True
        with self.assertRaises(ValueError):
            validate(d)
        d = copy.deepcopy(self.ledger)
        d["model_eligible"] = True
        with self.assertRaises(ValueError):
            validate(d)

    def test_source_cannot_redirect_to_unverified_site(self):
        d = copy.deepcopy(self.ledger)
        d["sources"][0]["url"] = "https://forecaster.example.com/ballots"
        with self.assertRaises(ValueError):
            validate(d)

if __name__ == "__main__":
    unittest.main()

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
        self.assertGreaterEqual(result["house_contests_transcribed"], 51)
        self.assertEqual(result["senate_contests_transcribed"], 3)
        self.assertEqual(result["candidate_ballot_entries"], sum(len(r["candidates"]) for r in self.ledger["races"]))
        self.assertGreaterEqual(result["candidate_ballot_entries"], 156)
        self.assertTrue(result["state_coverage"]["NC"]["full_house_snapshot"])
        self.assertTrue(result["state_coverage"]["FL"]["full_house_snapshot"])
        self.assertEqual(result["certified_2026_probability_count"], 0)
        self.assertEqual(result["house_contests_unverified"], 435-result["house_contests_transcribed"])
        self.assertEqual(result["state_coverage"]["FL"]["house"], 28)
        self.assertEqual(result["state_coverage"]["WY"]["house"], 1)
        self.assertTrue(result["state_coverage"]["WY"]["full_house_snapshot"])
        self.assertEqual(result["florida_unverified_districts"], [])
        self.assertGreaterEqual(result["qualified_write_in_entries_not_printed_on_ballot"], 12) # More verified states may add write-ins
        self.assertEqual(result["unopposed_offices_without_general_ballot"], ["FL-10"])
        self.assertEqual(result["house_general_ballot_contests_transcribed"], result["house_contests_transcribed"]-1)
        self.assertEqual(result["state_coverage"]["MD"]["house"], 8)
        self.assertEqual(result["state_coverage"]["MD"]["senate"], 0)
        self.assertTrue(result["state_coverage"]["MD"]["full_house_snapshot"])
        if any(r["state"]=="CA" for r in self.ledger["races"]):
            self.assertEqual(result["state_coverage"]["CA"]["house"], 52)
            self.assertEqual(result["state_coverage"]["CA"]["senate"], 0)
        self.assertEqual(self.ledger["races"][[r["id"] for r in self.ledger["races"]].index("FL-10")]["candidates"][0]["name"], "Maxwell Alejandro Frost")
        self.assertFalse(result["all_435_house_races_covered"])


    def test_new_source_offices_cover_kentucky_virginia_and_new_jersey(self):
        result=validate(self.ledger)
        for state,seat_count in (("KY",6),("VA",11),("NJ",12),("DE",1)):
            with self.subTest(state=state):
                self.assertEqual(result["state_coverage"][state]["house"],seat_count)
                self.assertTrue(result["state_coverage"][state]["full_house_snapshot"])
        self.assertGreaterEqual(result["house_contests_transcribed"],133)
        self.assertEqual(sum(len(r["candidates"]) for r in self.ledger["races"] if r["state"]=="NJ" and r["office"]=="H"),35)
        self.assertEqual(sum(len(r["candidates"]) for r in self.ledger["races"] if r["state"]=="KY" and r["office"]=="H"),21)
        self.assertEqual(sum(len(r["candidates"]) for r in self.ledger["races"] if r["state"]=="VA" and r["office"]=="H"),36)
        nj_petition=[c for r in self.ledger["races"] if r["state"]=="NJ" for c in r["candidates"] if c["party"]=="OTH"]
        self.assertTrue(nj_petition)
        self.assertTrue(all(c.get("ballot_label") for c in nj_petition))
        self.assertEqual(sum(c["party"]=="WRI" for r in self.ledger["races"] if r["state"]=="KY" for c in r["candidates"]),3)

    def test_original_massachusetts_and_nebraska_full_house_coverage(self):
        audit=validate(self.ledger)
        self.assertEqual(audit["state_coverage"]["MA"]["house"],9)
        self.assertEqual(audit["state_coverage"]["NE"]["house"],3)
        self.assertTrue(audit["state_coverage"]["MA"]["full_house_snapshot"])
        self.assertTrue(audit["state_coverage"]["NE"]["full_house_snapshot"])
        self.assertGreaterEqual(audit["house_contests_transcribed"],145)
        ma=[r for r in self.ledger["races"] if r["office"]=="H" and r["state"]=="MA"]
        ne=[r for r in self.ledger["races"] if r["office"]=="H" and r["state"]=="NE"]
        self.assertEqual(sum(len(r["candidates"]) for r in ma),17)
        self.assertEqual(sum(len(r["candidates"]) for r in ne),12)
        self.assertEqual(next(r for r in ma if r["id"]=="MA-01")["candidates"][0]["party"],"DEM")
        self.assertEqual(next(r for r in ne if r["id"]=="NE-03")["candidates"][-1]["ballot_label"],"By Petition")
        for row in ma+ne:
            self.assertFalse(row["fec_identity_match_certified"])
            self.assertEqual(row["verification"],"source_transcribed_as_of_review_date")

    def test_four_iowa_house_districts_use_state_original_source(self):
        audit=validate(self.ledger)
        self.assertEqual(audit["state_coverage"]["IA"]["house"],4)
        self.assertTrue(audit["state_coverage"]["IA"]["full_house_snapshot"])
        ia=[r for r in self.ledger["races"] if r["state"]=="IA" and r["office"]=="H"]
        self.assertEqual(set(r["id"] for r in ia),{"IA-01","IA-02","IA-03","IA-04"})
        self.assertEqual(sum(len(r["candidates"]) for r in ia),11)
        self.assertEqual(sum(c.get("ballot_label")=="No Party" for r in ia for c in r["candidates"]),2)
        self.assertGreaterEqual(audit["house_contests_transcribed"],149)

    def test_rhode_island_ballot_placement_slate_is_not_a_primary_filing_roll(self):
        audit=validate(self.ledger)
        self.assertEqual(audit["house_contests_transcribed"],151)
        self.assertEqual(audit["state_coverage"]["RI"]["house"],2)
        self.assertTrue(audit["state_coverage"]["RI"]["full_house_snapshot"])
        ri={r["id"]:r for r in self.ledger["races"] if r["state"]=="RI"}
        self.assertEqual(set(ri),{"RI-01","RI-02"})
        self.assertEqual([c["party"] for c in ri["RI-01"]["candidates"]],["DEM","IND","REP"])
        self.assertEqual([c["party"] for c in ri["RI-02"]["candidates"]],["DEM","REP"])
        self.assertEqual(len(ri["RI-01"]["candidates"]),3)
        self.assertEqual(len(ri["RI-02"]["candidates"]),2)
        self.assertEqual(len({c["name"] for r in ri.values() for c in r["candidates"]}),5)

    def test_no_duplicate_race(self):
        d = copy.deepcopy(self.ledger)
        d["races"].append(copy.deepcopy(d["races"][0]))
        with self.assertRaises(ValueError):
            validate(d)

    def test_not_transcribed_source_cannot_supply_fake_races(self):
        d = copy.deepcopy(self.ledger)
        fake = copy.deepcopy(d["races"][0])
        fake.update(id="NV-01",state="NV",district="01",office="H",source_id="NV_SOS_2026_GENERAL")
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

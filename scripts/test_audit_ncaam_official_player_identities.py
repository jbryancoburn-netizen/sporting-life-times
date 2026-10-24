"""Regression tests for source-grounded NCAA preseason identity negatives."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import audit_ncaam_official_player_identities as model
class AthleteOfficialIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        names=["ncaam-2026-27-player-movement-audit.json",
               "ncaam-2026-27-direct-player-crosswalk.json",
               "ncaam-2026-27-minutes-retention-audit.json",
               "ncaam-2026-27-official-negative-player-identities.json",
               "ncaam-2026-27-preseason-roster-informed.json"]
        cls.source=[model.read_json(model.ROOT/name) for name in names]
    def simulate(self,index,mutate):
        inputs=list(self.source)
        inputs[index]=copy.deepcopy(inputs[index])
        mutate(inputs[index])
        return model.verify(*inputs)
    def test_real_reconciled_exclusions(self):
        d=model.verify(*self.source)
        s=d["summary"]
        self.assertEqual(s["school_officially_rejected_false_prior_player_links"],14)
        self.assertEqual(s["open_high_priority_candidate_links"],16)
        self.assertEqual(s["source_unlinked_unique_name_transfer_candidates"],26)
        self.assertEqual(s["source_unlinked_ambiguous_name_cases"],4)
        self.assertEqual(s["source_unlinked_without_prior_d1_box"],1984)
        self.assertEqual(s["source_unlinked_athletes"],2014)
        self.assertEqual(s["prior_player_ids_credited_to_multiple_current_athletes"],0)
        self.assertTrue(all(not r["actually_used_by_official_or_experimental_elo"] for r in d["officially_disambiguated_exclusions"]))
        self.assertTrue(all(not r["eligible_for_elo"] for r in d["high_priority_positive_identity_review_queue"]))
    def test_negative_id_if_ever_linked_fails_closed(self):
        false_id=self.source[3]["records"][0]["current_espn_id"]
        with self.assertRaisesRegex(ValueError,"Unlinked ESPN athletes|Prior minutes for OFFICIALLY"):
            self.simulate(1,lambda c:c["links"].__setitem__(0,{**c["links"][0],"id":false_id}))
    def test_same_historical_player_cannot_be_used_twice(self):
        def corrupt(c):
            c["links"][1]["pid"]=c["links"][0]["pid"]
        with self.assertRaisesRegex(ValueError,"One 2025-26 NCAA player"):
            self.simulate(1,corrupt)
    def test_university_source_must_be_official(self):
        with self.assertRaisesRegex(ValueError,"official"):
            self.simulate(3,lambda d:d["records"][0].__setitem__("school_source_url","https://example.com/claim"))
    def test_adjudication_requires_exact_player_id_name_and_team(self):
        with self.assertRaisesRegex(ValueError,"missing or moved"):
            self.simulate(3,lambda d:d["records"][0].__setitem__("current_espn_id","99999999"))
    def test_any_missing_negative_adjudication_blocks_audit(self):
        with self.assertRaisesRegex(ValueError,"Unexpected vetted exclusions"):
            self.simulate(3,lambda d:d["records"].pop())
if __name__=="__main__":unittest.main()

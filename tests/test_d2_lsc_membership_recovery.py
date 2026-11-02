"""Test evidence-backed additions to men's, but not women's, DII directory."""
import importlib.util
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("d2_lsc_members",
    ROOT/"scripts"/"build_d2_basketball.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LSCMembershipRecoveryTests(unittest.TestCase):
    def test_seed_only_official_national_collegiate_athletic_association_members(self):
        men={}
        outcome=module.supplement_verified_lsc_mens_directory("men",men)
        self.assertEqual(outcome["added"],2)
        self.assertEqual(set(men),{
            "university-of-texas-at-dallas","the-university-of-texas-at-tyler"})
        for ident,record in men.items():
            self.assertEqual(record["id"],ident)
            self.assertEqual(record["conference"],"LSC")
            self.assertTrue(record["d2_confirmed"])
            self.assertTrue(record["membership_source"].startswith(
                "https://web3.ncaa.org/directory/orgDetail?id="))
            self.assertNotIn("elo",record)
            self.assertNotIn("games",record)
            self.assertNotIn("w",record)
            self.assertNotIn("l",record)
        self.assertEqual(men["university-of-texas-at-dallas"]["slug"],"texas-dallas")
        self.assertEqual(men["the-university-of-texas-at-tyler"]["slug"],"texas-tyler")
        again=module.supplement_verified_lsc_mens_directory("men",men)
        self.assertEqual(again["added"],0)
        self.assertEqual(len(men),2)
    def test_do_not_mutate_women_or_override_existing_identity(self):
        women={"existing":{"id":"existing","name":"Existing"}}
        result=module.supplement_verified_lsc_mens_directory("women",women)
        self.assertEqual(result["added"],0)
        self.assertEqual(len(women),1)
        custom={"university-of-texas-at-dallas":{"id":"university-of-texas-at-dallas",
                 "name":"Existing Verified Institution","verified_nationally":True}}
        result=module.supplement_verified_lsc_mens_directory("men",custom)
        self.assertEqual(result["added"],1)
        self.assertEqual(custom["university-of-texas-at-dallas"]["name"],
                         "Existing Verified Institution")
        self.assertEqual(custom["university-of-texas-at-dallas"]["verified_nationally"],True)
if __name__=="__main__":unittest.main()

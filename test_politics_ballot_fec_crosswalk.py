"""No fuzzy identities and no ballot authority inferred from FEC reports."""
import copy
import json
import unittest
from scripts.politics_ballot_audit import ROOT
from scripts.politics_ballot_fec_crosswalk import build,keyname

class CrosswalkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ballots=json.loads((ROOT/"politics-official-ballots.json").read_text())

    def fixture(self):
        return {"status":"ok","cycle":2026,"candidates":[
            {"id":"H6FL00001","name":"ASKAR, CASEY","state":"FL","office":"H","district":"22",
             "party":"REP","fec_registration_only":True,
             "finance":{"receipts":1000,"cash_on_hand":500,"report_end":"2026-09-30"}},
            {"id":"H6FL00002","name":"ASKAR, CASEY","state":"FL","office":"H","district":"21",
             "party":"REP","fec_registration_only":True},
            {"id":"H6FL00003","name":"DANDIYA, PIA","state":"FL","office":"H","district":"22",
             "party":"DEM","fec_registration_only":True}
        ]}

    def row(self,output,name):
        return next(x for x in output["entries"] if x["race_id"]=="FL-22" and x["candidate"]==name)

    def test_exact_matches_district_party_full_name_only(self):
        data=build(self.ballots,self.fixture())
        r=self.row(data,"Casey Askar")
        self.assertEqual(r["fec_id"],"H6FL00001")
        self.assertEqual(r["finance"]["report_end"],"2026-09-30")
        self.assertEqual(self.row(data,"Pia Dandiya")["fec_id"],"H6FL00003")
        self.assertEqual(data["candidate_records"],sum(len(r["candidates"]) for r in self.ballots["races"]))
        self.assertFalse(data["forecast_eligible"])
        self.assertEqual(data["certified_2026_probability_count"],0)

    def test_misplaced_fec_candidate_not_associated(self):
        f=self.fixture()
        f["candidates"][0]["district"]="21"
        data=build(self.ballots,f)
        self.assertEqual(self.row(data,"Casey Askar")["status"],"no_exact_identity")

    def test_wrong_party_and_spelling_are_never_guessed(self):
        f=self.fixture()
        f["candidates"][0]["party"]="DEM"
        self.assertIsNone(self.row(build(self.ballots,f),"Casey Askar")["fec_id"])
        f=self.fixture()
        f["candidates"][0]["name"]="ASKAR, CASE"
        self.assertIsNone(self.row(build(self.ballots,f),"Casey Askar")["fec_id"])

    def test_duplicate_same_identity_is_ambiguous(self):
        f=self.fixture()
        f["candidates"].append({**f["candidates"][0],"id":"H6FL00004"})
        result=self.row(build(self.ballots,f),"Casey Askar")
        self.assertEqual(result["status"],"ambiguous")
        self.assertIsNone(result["fec_id"])

    def test_no_quiet_fec_ballot_substitution(self):
        d=copy.deepcopy(self.ballots)
        d["races"][0]["source_id"]="unapproved_source"
        with self.assertRaises(ValueError):build(d,self.fixture())

    def test_registration_guard(self):
        f=self.fixture()
        del f["candidates"][0]["fec_registration_only"]
        with self.assertRaises(ValueError):build(self.ballots,f)

    def test_canonical_name(self):
        self.assertEqual(keyname("ROSS, DEBORAH K",True),keyname("Deborah K Ross"))
        self.assertNotEqual(keyname("ROSS, DEBORAH K",True),keyname("Deborah Ross"))
if __name__=="__main__":unittest.main()

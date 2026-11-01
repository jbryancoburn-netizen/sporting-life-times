"""Fail-closed checks on California SOS certified federal ballot list text."""
import copy
import json
import unittest
from scripts.politics_ballot_audit import ROOT
from scripts.politics_ca_certified_ballots import parse_house,integrate,PARTY,SOURCE_ID

class CaliforniaCandidateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger=json.loads((ROOT/"politics-official-ballots.json").read_text())
    def test_two_district_sample_with_official_multispace_format(self):
        sample="""United States Representative District 1
Mike McGuire                                 Democratic
California State Senator
James Gallagher                                Republican
United States Representative/Farmer

United States Representative District 2
Jared Huffman                              Democratic
U.S. Representative
Robin Littau                                  Republican
State Senator District 1
"""
        rows=parse_house(sample,required=2)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]["id"],"CA-01")
        self.assertEqual(rows[0]["candidates"],[{"name":"Mike McGuire","party":"DEM"},{"name":"James Gallagher","party":"REP"}])
        self.assertEqual(rows[1]["candidates"][1]["name"],"Robin Littau")
        self.assertTrue(all(x["fec_identity_match_certified"] is False for x in rows))
    def test_district_duplicate_or_missing_rejected(self):
        bad="United States Representative District 1\nA Name       Democratic\nB Name       Republican\n"
        with self.assertRaises(ValueError):parse_house(bad,required=2)
        with self.assertRaises(ValueError):parse_house(bad+bad,required=2)
    def test_candidate_duplication_not_silently_accepted(self):
        bad="""United States Representative District 1
A Name       Democratic
A Name       Democratic
United States Representative District 2
C Name       Republican
D Name       Democratic
"""
        with self.assertRaises(ValueError):parse_house(bad,required=2)
    def test_unknown_party_line_does_not_create_fake_nominee(self):
        bad="""United States Representative District 1
A Name       Democratic
B Name       Party invented
United States Representative District 2
C Name       Republican
D Name       Democratic
"""
        with self.assertRaises(ValueError):parse_house(bad,required=2)
    def test_all_house_districts_required_before_updating_other_states(self):
        d=copy.deepcopy(self.ledger)
        # Test first-time import even when checked-in production data already contain CA.
        d["races"]=[r for r in d["races"] if r["state"]!="CA"]
        rows=[{"id":f"CA-{i:02d}","state":"CA","office":"H","district":f"{i:02d}",
               "source_id":SOURCE_ID,"candidates":[{"name":"Dem Candidate","party":"DEM"},{"name":"Rep Candidate","party":"REP"}],
               "verification":"source_transcribed_as_of_review_date","fec_identity_match_certified":False} for i in range(1,53)]
        m=integrate(d,rows,"2026-11-01")
        self.assertEqual(sum(r["state"]=="CA" for r in m["races"]),52)
        self.assertEqual(sum(r["state"]=="NC" for r in m["races"]),sum(r["state"]=="NC" for r in d["races"]))
        self.assertEqual(sum(r["state"]=="FL" for r in m["races"]),sum(r["state"]=="FL" for r in d["races"]))
        self.assertFalse(m["model_eligible"])
        self.assertEqual(m,integrate(m,rows,"2026-11-01"))
        with self.assertRaises(ValueError):integrate(d,rows[:-1])
        changed=copy.deepcopy(m)
        next(r for r in changed["races"] if r["id"]=="CA-52")["candidates"][0]["name"]="Different"
        with self.assertRaises(ValueError):integrate(changed,rows)
if __name__=="__main__":unittest.main()

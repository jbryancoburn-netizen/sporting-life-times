"""Offline tests of 2025-26 NCAA-origin historical ID joins."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_ncaam_historical_identity_links import link

def fake_evidence():
    return {"teams_checked":365,"institutional_source_confirmations":3,
            "uncorroborated_ambiguous_count":0,
            "records":[
                {"espn_athlete_id":"100","player":"Nate Example","team_id":"ncaa:2",
                 "prior_team_id":"ncaa:1","category":"transfer",
                 "institutional_source":"https://example.edu/nate",
                 "historical_ncaa_player_id":None,"historical_ncaa_box_match_verified":False},
                {"espn_athlete_id":"101","player":"Sam Student","team_id":"ncaa:2",
                 "prior_team_id":"ncaa:2","category":"returner",
                 "institutional_source":"https://example.edu/sam",
                 "historical_ncaa_player_id":None,"historical_ncaa_box_match_verified":False},
                {"espn_athlete_id":"102","player":"Alex Incoming","team_id":"ncaa:3",
                 "prior_team_id":None,"category":"new-to-d1",
                 "institutional_source":"https://example.edu/alex",
                 "historical_ncaa_player_id":None,"historical_ncaa_box_match_verified":False}
            ]}

def row(team,player,pid,contest='g1',mins='27',pts='13'):
    return {"team_ncaa_team_id":str(team),"clean_name":player,
            "player_id":str(pid),"contest_id":contest,"mins":mins,"pts":pts}

class IdentityJoinTests(unittest.TestCase):
    def test_two_source_correlated_athletes_link_to_ncaa_ids(self):
        result=link(fake_evidence(),[
            row(1,"Nate Example",901,"g1"),row(1,"Nate Example",901,"g2",mins="25",pts="7"),
            row(2,"Sam Student",902,"g3"),row(4,"Nate Example",999,"g4")],
            {"ncaa:1","ncaa:2","ncaa:3"})
        self.assertEqual(result["source_correlated_ncaa_player_matches"],2)
        self.assertEqual(result["new_to_d1_no_box_expected"],1)
        self.assertEqual(result["uncertain_historical_identity_count"],0)
        self.assertEqual(result["matched"][0]["historical_ncaa_player_id"],"901")
        self.assertEqual(result["matched"][0]["prior_minutes"],52)
        self.assertFalse(result["matched"][0]["direct_cross_provider_id_match"])
        self.assertFalse(result["approved_for_primary"])
    def test_duplicate_historical_name_within_school_is_excluded(self):
        result=link(fake_evidence(),[row(1,"Nate Example",901),row(1,"Nate Example",903,"g2")])
        self.assertEqual(result["uncertain_historical_identity_count"],2)
        self.assertEqual(result["unlinked"][0]["status"],"multiple_prior_ncaa_players")
    def test_missing_historical_box_stays_uncertain(self):
        result=link(fake_evidence(),[])
        self.assertEqual(result["source_correlated_ncaa_player_matches"],0)
        self.assertEqual(result["uncertain_historical_identity_count"],2)
    def test_misassigned_prior_school_rejected(self):
        x=fake_evidence()
        x["records"][0]["prior_team_id"]="ncaa:999"
        with self.assertRaisesRegex(ValueError,"not in canonical"):
            link(x,[],{"ncaa:1","ncaa:2","ncaa:3"})
    def test_duplicate_current_espn_id_rejected(self):
        x=fake_evidence()
        x["records"][1]["espn_athlete_id"]="100"
        with self.assertRaisesRegex(ValueError,"duplicate current"):
            link(x,[])
    def test_preexisting_fake_verified_id_rejected(self):
        x=fake_evidence()
        x["records"][0]["historical_ncaa_player_id"]="999"
        with self.assertRaisesRegex(ValueError,"assumed NCAA"):
            link(x,[])
    def test_duplicate_historical_box_row_rejected(self):
        with self.assertRaisesRegex(ValueError,"Duplicate source"):
            link(fake_evidence(),[row(1,"Nate Example",901),row(1,"Nate Example",901)])
    def test_missing_school_proof_rejected(self):
        x=fake_evidence()
        x["uncorroborated_ambiguous_count"]=1
        with self.assertRaisesRegex(ValueError,"Incomplete official"):
            link(x,[])
if __name__=="__main__":unittest.main()

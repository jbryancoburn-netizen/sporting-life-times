"""Deterministic offline checks for institution-sourced NCAA player history annotations."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from apply_ncaam_official_identities import resolve

def fixture():
    teams = [{"team_id":f"ncaa:{i}", "team":f"School {i}",
              "players":[{"player":"Alex Smith","current_id":"1001",
                           "status":"id-not-found-name-ambiguous","prior_school_id":None}]
                         if i==0 else [{"player":"Student "+str(i),
                                        "current_id":str(2000+i),
                                        "status":"no-prior-d1-box","prior_school_id":None}]}
             for i in range(365)]
    movement = {"season":"2026-27","roster_teams":365,"players_audited":365,
                "player_status_counts":{"id-not-found-name-ambiguous":1,"no-prior-d1-box":364},
                "teams":teams}
    proof = {"season":"2026-27","records":[{
        "espn_athlete_id":"1001","name":"Alex Smith","team":"School 0",
        "team_id":"ncaa:0","classification":"transfer","prior_team_id":"ncaa:55",
        "source_url":"https://example.edu/mens-basketball/alex-smith",
        "source_type":"institutional-athletics"
    }]}
    return movement,proof

class InstitutionalIdentityTests(unittest.TestCase):
    def test_reconciles_without_inventing_ncaa_ids(self):
        result=resolve(*fixture())
        self.assertEqual(result["uncorroborated_ambiguous_count"],0)
        self.assertEqual(result["institutional_source_confirmations"],1)
        self.assertEqual(result["unmatched_prior_d1_box_count"],364)
        self.assertIsNone(result["records"][0]["historical_ncaa_player_id"])
        self.assertFalse(result["production_elo_approved"])
        self.assertFalse(result["records"][0]["eligible_for_player_minutes_input"])
    def test_missing_evidence_stays_unresolved(self):
        raw,evidence=fixture()
        evidence["records"]=[]
        self.assertEqual(resolve(raw,evidence)["uncorroborated_ambiguous_count"],1)
    def test_wrong_team_rejected(self):
        raw,evidence=fixture()
        evidence["records"][0]["team_id"]="ncaa:1"
        with self.assertRaisesRegex(ValueError,"does not match"):
            resolve(raw,evidence)
    def test_wrong_student_rejected(self):
        raw,evidence=fixture()
        evidence["records"][0]["name"]="Different"
        with self.assertRaisesRegex(ValueError,"does not match"):
            resolve(raw,evidence)
    def test_duplicate_evidence_rejected(self):
        raw,evidence=fixture()
        evidence["records"].append(copy.deepcopy(evidence["records"][0]))
        with self.assertRaisesRegex(ValueError,"duplicated"):
            resolve(raw,evidence)
    def test_self_transfer_rejected(self):
        raw,evidence=fixture()
        evidence["records"][0]["prior_team_id"]="ncaa:0"
        with self.assertRaisesRegex(ValueError,"prior school"):
            resolve(raw,evidence)
    def test_freshman_cannot_have_prior_team(self):
        raw,evidence=fixture()
        evidence["records"][0]["classification"]="new-to-d1"
        with self.assertRaisesRegex(ValueError,"must be unset"):
            resolve(raw,evidence)
    def test_bad_source_rejected(self):
        raw,evidence=fixture()
        evidence["records"][0]["source_url"]="not-a-url"
        with self.assertRaisesRegex(ValueError,"institutional evidence"):
            resolve(raw,evidence)
    def test_player_count_corruption_rejected(self):
        raw,evidence=fixture()
        raw["players_audited"]=400
        with self.assertRaisesRegex(ValueError,"count mismatch"):
            resolve(raw,evidence)

if __name__ == "__main__":
    unittest.main()

"""DII schedule recovery must distinguish legitimate member gaps from non-DII directory rows."""
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("d2_release_eligibility",ROOT/"scripts"/"audit_d2_publication.py")
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class EligibilityRecoveryTests(unittest.TestCase):
    def test_ineligible_directory_entries_are_not_missing_dii_schedules(self):
        teams=[
            {"id":"west-florida","name":"West Florida","conference":"GSC",
             "not_eligible_for_dii_elo":True},
            {"id":"future-applicant","name":"Future Applicant","conference":"GSC",
             "not_eligible_for_dii_elo":True},
            {"id":"member","name":"Verified Member","conference":"GSC"},
        ]
        games=[{"date":"2026-11-08","away":"member","home":"other"},
               {"date":"2026-11-10","away":"member","home":"other"}]
        result=audit.school_schedule_coverage(teams,games)
        self.assertEqual(result["without_games"],2)  # legacy directory compatibility
        self.assertEqual(result["eligible_without_games"],0)
        self.assertEqual(result["eligible_programs_with_games"],1)
        self.assertEqual(result["ineligible_zero_game_count"],2)
        self.assertEqual({x["id"] for x in result["ineligible_zero_game_schools"]},
                         {"west-florida","future-applicant"})
        self.assertEqual(result["eligible_zero_game_schools"],[])
        self.assertEqual(result["conference_gaps"]["GSC"]["without_games"],2)

    def test_true_eligible_gaps_and_thin_schedules_remain_visible(self):
        teams=[
            {"id":"charleston","name":"Charleston","conference":"MEC"},
            {"id":"wheeling","name":"Wheeling","conference":"MEC"},
            {"id":"west-florida","name":"West Florida","conference":"GSC",
             "not_eligible_for_dii_elo":True},
        ]
        games=[{"date":"2026-11-20","away":"wheeling","home":"external"},
               {"date":"2026-11-20","away":"wheeling","home":"external"}]
        result=audit.school_schedule_coverage(teams,games)
        self.assertEqual(result["eligible_programs"],2)
        self.assertEqual(result["ineligible_programs"],1)
        self.assertEqual(result["eligible_without_games"],1)
        self.assertEqual(result["eligible_with_1_to_6_games"],1)
        self.assertEqual([x["id"] for x in result["eligible_zero_game_schools"]],["charleston"])
        self.assertEqual([x["id"] for x in result["eligible_thin_schedule_priority"]],["wheeling"])
        self.assertEqual(result["ineligible_zero_game_count"],1)

    def test_membership_status_comes_from_live_team_eligibility(self):
        teams=[
            {"id":"nonmember","name":"Nonmember","not_eligible_for_dii_elo":True},
            {"id":"candidate","name":"Reclassifying DII Member","not_eligible_for_dii_elo":False},
        ]
        result=audit.school_schedule_coverage(teams,[])
        self.assertEqual(result["eligible_without_games"],1)
        self.assertEqual(result["ineligible_zero_game_count"],1)
        self.assertEqual(result["eligible_zero_game_schools"][0]["id"],"candidate")
        self.assertEqual(result["ineligible_zero_game_schools"][0]["id"],"nonmember")

if __name__=="__main__":
    unittest.main()

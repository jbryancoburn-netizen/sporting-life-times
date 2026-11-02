import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("d2_membership",ROOT/"scripts"/"build_d2_basketball.py")
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class MembershipTests(unittest.TestCase):
    def test_official_announcements_preserve_future_candidacy_status(self):
        men=json.loads((ROOT/"data"/"d2-men-2026-27.json").read_text())
        women=json.loads((ROOT/"data"/"d2-women-2026-27.json").read_text())
        candidates={t["id"]:t for t in men["teams"]}
        self.assertIn(men["quality"]["membership_review"]["excluded_from_dii_elo"],(4,5,6,7))
        self.assertIn(women["quality"]["membership_review"]["excluded_from_dii_elo"],(0,1))
        for ident in ("lackawanna-college","monroe-university",
                      "loyola-university-new-orleans","texas-wesleyan-university"):
            self.assertTrue(candidates[ident]["not_eligible_for_dii_elo"])
            self.assertEqual(candidates[ident]["d2_confirmed"],False)
            self.assertTrue(candidates[ident]["membership_source"].startswith("https://"))
        if men["quality"]["membership_review"]["excluded_from_dii_elo"]>=5:
            self.assertTrue(candidates["azusa-pacific"]["not_eligible_for_dii_elo"])
            self.assertFalse(candidates["azusa-pacific"]["d2_confirmed"])
        self.assertIn(len(men["teams"]),(299,301))
        # During migration both snapshots can be valid. The next release
        # restores the two NCAA-verified teams without moving women's Elo.
        if len(men["teams"])==301:
            self.assertEqual(candidates["university-of-texas-at-dallas"]["conference"],"LSC")
            self.assertEqual(candidates["the-university-of-texas-at-tyler"]["conference"],"LSC")
            self.assertEqual(candidates["university-of-texas-at-dallas"]["membership_source"],
                             "https://web3.ncaa.org/directory/orgDetail?id=23121")
        self.assertEqual(len(women["teams"]),298)
        lookup=builder.build_dii_team_lookup(candidates)
        self.assertIsNone(builder.resolve_dii_team_id({"name":"Texas Wesleyan University"},lookup))
        self.assertEqual(builder.resolve_dii_team_id({"name":"Adams State"},lookup),"adams-state")

    def test_texarkana_competes_naia_until_2027_and_cannot_change_dii_elo(self):
        notes=json.loads((ROOT/"data"/"d2-membership-notes-2026-27.json").read_text())
        for gender in ("men","women"):
            record=notes[gender]["texas-a-m-university-texarkana"]
            self.assertTrue(record["not_eligible_for_dii_elo"])
            self.assertIn("NAIA",record["status"])
            self.assertIn("2027",record["note"])
            teams={
                "texas-a-m-university-texarkana":{"id":"texas-a-m-university-texarkana","name":"Texas A&M–Texarkana"},
                "washburn":{"id":"washburn","name":"Washburn"}}
            refreshed=builder.apply_membership_notes(gender,teams)
            self.assertEqual(refreshed["excluded_from_dii_elo"],1)
            self.assertTrue(teams["texas-a-m-university-texarkana"]["not_eligible_for_dii_elo"])
            games={"verified-source-001":{"id":"verified-source-001","date":"2026-11-14",
                "away":"texas-a-m-university-texarkana","home":"washburn",
                "status":"scheduled","elo_eligible":True,"away_score":None,"home_score":None,
                "pregame_elo_home":1500.0,"pred_home_pct":55.0}}
            updated=builder.enforce_dii_elo_member_gate(games,teams)
            self.assertEqual(updated,1)
            g=games["verified-source-001"]
            self.assertFalse(g["elo_eligible"])
            self.assertEqual(g["id"],"verified-source-001")
            self.assertEqual(g["status"],"scheduled")
            self.assertNotIn("pred_home_pct",g)
            self.assertEqual(g["elo_exclusion_source"],record["source"])
            self.assertEqual(builder.enforce_dii_elo_member_gate(games,teams),0)

    def test_nightly_refresh_restores_eligibility_annotations(self):
        teams={"monroe-university":{"name":"Monroe University","id":"monroe-university","slug":""},
               "adams-state":{"name":"Adams State","id":"adams-state","slug":"adams-st"}}
        result=builder.apply_membership_notes("men",teams)
        self.assertEqual(result["annotated"],1)
        self.assertEqual(result["excluded_from_dii_elo"],1)
        self.assertFalse(teams["monroe-university"]["d2_confirmed"])
        self.assertNotIn("not_eligible_for_dii_elo",teams["adams-state"])


if __name__=="__main__":
    unittest.main()

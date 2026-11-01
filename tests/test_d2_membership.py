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
        self.assertEqual(men["quality"]["membership_review"]["excluded_from_dii_elo"],4)
        self.assertEqual(women["quality"]["membership_review"]["excluded_from_dii_elo"],0)
        for ident in ("lackawanna-college","monroe-university",
                      "loyola-university-new-orleans","texas-wesleyan-university"):
            self.assertTrue(candidates[ident]["not_eligible_for_dii_elo"])
            self.assertEqual(candidates[ident]["d2_confirmed"],False)
            self.assertTrue(candidates[ident]["membership_source"].startswith("https://"))
        self.assertEqual(len(men["teams"]),299)
        self.assertEqual(len(women["teams"]),298)
        lookup=builder.build_dii_team_lookup(candidates)
        self.assertIsNone(builder.resolve_dii_team_id({"name":"Texas Wesleyan University"},lookup))
        self.assertEqual(builder.resolve_dii_team_id({"name":"Adams State"},lookup),"adams-state")

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

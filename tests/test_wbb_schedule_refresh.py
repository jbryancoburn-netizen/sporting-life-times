"""Offline safeguards for the women's 363-team calendar refresh."""
import copy
import runpy
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORTER = runpy.run_path(str(ROOT / "scripts/wbb-team-schedules.py"))
MAUI = runpy.run_path(str(ROOT / "scripts/apply_ncaaw_maui_tipoff_corrections.py"))


def game(gid, owner, rival, when, site="neutral"):
    return {
        "id":gid, "date":when, "opponent_id":rival,
        "home_id":owner, "away_id":rival, "site":site,
        "venue":"Tournament Site",
    }


class WomensCalendarRefreshTests(unittest.TestCase):
    def test_matching_game_keeps_cited_university_proof(self):
        original = game("401000001", "204", "999", "2026-12-19T01:00Z")
        original.update(
            official_schedule_source_url="https://example.edu/wbb/2026",
            official_schedule_source_type="official_university_2026_27_womens_schedule",
            official_schedule_verified_fields=["scheduled_date", "opponent", "home_away"],
            official_venue_verified=True,
            official_venue_source_url="https://example.edu/wbb/2026",
        )
        refreshed = game("401000001", "204", "999", "2026-12-19T02:00Z")
        self.assertEqual(IMPORTER["retain_official_evidence"](
            {"games":[original]}, {"games":[refreshed]}), 1)
        self.assertEqual(refreshed["official_schedule_source_url"],
                         original["official_schedule_source_url"])
        self.assertTrue(refreshed["official_venue_verified"])

    def test_evidence_does_not_follow_changed_opponent_or_day(self):
        old = game("401000001", "204", "999", "2026-12-19T01:00Z")
        old["official_schedule_source_url"] = "https://example.edu/wbb/2026"
        changed = game("401000001", "204", "888", "2026-12-19T01:00Z")
        self.assertEqual(IMPORTER["retain_official_evidence"](
            {"games":[old]}, {"games":[changed]}), 0)
        self.assertNotIn("official_schedule_source_url", changed)
        day_changed = game("401000001", "204", "999", "2026-12-21T01:00Z")
        self.assertEqual(IMPORTER["retain_official_evidence"](
            {"games":[old]}, {"games":[day_changed]}), 0)

    def test_site_change_invalidates_prior_home_away_proof(self):
        old = game("401000001", "204", "999", "2026-12-19T01:00Z")
        old["official_schedule_verified_fields"] = [
            "scheduled_date", "opponent", "home_away"]
        old["official_schedule_source_url"] = "https://example.edu/wbb"
        new = game("401000001", "204", "999", "2026-12-19T01:00Z", "home")
        IMPORTER["retain_official_evidence"]({"games":[old]}, {"games":[new]})
        self.assertNotIn("home_away", new["official_schedule_verified_fields"])

    def test_maui_organizer_tipoffs_are_reapplied_to_both_school_copies(self):
        a = game("401928314", "204", "999", "2026-12-19T01:00Z")
        b = game("401928314", "204", "999", "2026-12-19T01:00Z")
        c = game("401928315", "204", "888", "2026-12-20T01:00Z")
        d = game("401928315", "204", "888", "2026-12-20T01:00Z")
        records = {"season":"2026-27", "gender":"women", "teams":{
            "204":{"games":[a,c]},
            "999":{"games":[b]},
            "888":{"games":[d]},
        }}
        self.assertEqual(MAUI["apply"](records), 4)
        self.assertEqual(MAUI["apply"](records), 0)
        self.assertEqual({g["date"] for team in records["teams"].values()
                          for g in team["games"] if g["id"]=="401928314"},
                         {"2026-12-19T03:00Z"})
        self.assertTrue(all(g["official_tipoff_verified"]
                            for team in records["teams"].values()
                            for g in team["games"]))

    def test_maui_rejects_one_sided_game_before_publish(self):
        broken = {"season":"2026-27", "gender":"women", "teams":{
            "204":{"games":[game("401928314","204","999","2026-12-19T01:00Z"),
                            game("401928315","204","888","2026-12-20T01:00Z")]},
            "888":{"games":[game("401928315","204","888","2026-12-20T01:00Z")]},
        }}
        with self.assertRaises(ValueError):
            MAUI["apply"](broken)

    def test_reciprocal_validator_rejects_missing_division_one_copy(self):
        first = game("401000001","204","999","2026-12-19T03:00Z")
        second = game("401000001","204","204","2026-12-19T03:00Z")
        second["away_id"] = "999"
        calendars={"204":{"games":[first]}, "999":{"games":[second]}}
        IMPORTER["validate_reciprocal_games"](calendars)
        calendars["999"]["games"].clear()
        with self.assertRaisesRegex(RuntimeError, "Missing reciprocal"):
            IMPORTER["validate_reciprocal_games"](calendars)


if __name__ == "__main__":
    unittest.main()

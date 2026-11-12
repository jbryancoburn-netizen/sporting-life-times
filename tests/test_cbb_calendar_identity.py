"""Regression: a coincidental basketball score/date is not proof of a published final."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_cbb_finals_health import calendar_matches_verified_final, public_calendars

TIP = datetime(2026, 11, 11, 23, 0, tzinfo=timezone.utc)
ID = "401900111"
SCORES = {"84": 78, "153": 72}


def game(id=ID, away="153", home="84", home_score=78, away_score=72,
         completed=True, date="2026-11-11T23:00:00Z", official=False):
    row = {"id": id, "date": date,
           "status": {"type": {"completed": completed}},
           "competitions": [{"competitors": [
               {"homeAway": "home", "team": {"id": home}, "score": home_score},
               {"homeAway": "away", "team": {"id": away}, "score": away_score}
           ]}]}
    if official:
        row.update({"official_source": True,
                    "school_source_url": "https://iuhoosiers.com/sports/mens-basketball/schedule"})
    return row


class CalendarIdentityTests(unittest.TestCase):
    def test_canonical_game_matches_correct_final(self):
        self.assertTrue(calendar_matches_verified_final(game(), ID, SCORES, TIP))

    def test_same_score_same_day_different_opponents_does_not_match(self):
        self.assertFalse(calendar_matches_verified_final(
            game(id="another-game", away="333", home="444"), ID, SCORES, TIP))

    def test_same_score_same_teams_unverified_alternate_id_does_not_match(self):
        self.assertFalse(calendar_matches_verified_final(
            game(id="another-game"), ID, SCORES, TIP))

    def test_official_university_alternate_id_is_supported(self):
        self.assertTrue(calendar_matches_verified_final(
            game(id="official-indiana-2026-11-11-153", official=True), ID, SCORES, TIP))

    def test_official_bad_opponents_still_rejected(self):
        self.assertFalse(calendar_matches_verified_final(
            game(id="official-other", away="222", home="777", official=True), ID, SCORES, TIP))

    def test_verified_school_retro_alias_accepts_real_indiana_final(self):
        row=game(id="indiana-official-2027-1")
        row["retro_verified_final"]="espn:"+ID
        row["site_verified"]=True
        row["site_source_url"]="https://iuhoosiers.com/sports/mens-basketball/schedule/print"
        self.assertTrue(calendar_matches_verified_final(row,ID,SCORES,TIP))

    def test_school_retro_alias_rejects_unverified_linkage(self):
        row=game(id="indiana-official-2027-1")
        row["retro_verified_final"]="espn:"+ID
        row["site_source_url"]="https://iuhoosiers.com/sports/mens-basketball/schedule/print"
        self.assertFalse(calendar_matches_verified_final(row,ID,SCORES,TIP))

    def test_school_retro_alias_rejects_wrong_score(self):
        row=game(id="indiana-official-2027-1",home_score=77)
        row["retro_verified_final"]="espn:"+ID
        row["site_verified"]=True
        row["site_source_url"]="https://iuhoosiers.com/sports/mens-basketball/schedule/print"
        self.assertFalse(calendar_matches_verified_final(row,ID,SCORES,TIP))

    def test_bad_score_is_rejected_even_with_matching_id(self):
        self.assertFalse(calendar_matches_verified_final(
            game(home_score=79), ID, SCORES, TIP))

    def test_uncompleted_game_does_not_pass(self):
        self.assertFalse(calendar_matches_verified_final(
            game(completed=False), ID, SCORES, TIP))

    def test_wrong_day_does_not_pass(self):
        self.assertFalse(calendar_matches_verified_final(
            game(date="2026-11-08T23:00:00Z"), ID, SCORES, TIP))

    def test_women_quarantined_final_is_not_silently_accepted(self):
        from unittest.mock import patch
        source = {ID: ("84", "153", 78, 72, TIP)}
        published = {"teams": {
            "84": {"games": [{"id": ID, "completed": True, "home_id": "84",
                              "away_id": "153", "home_score": 78, "away_score": 72}]},
            "153": {"games": [{"id": ID, "completed": True, "home_id": "84",
                               "away_id": "153", "home_score": 78, "away_score": 72}]},
        }}
        quarantine = {"quarantined_schedule_conflicts": [
            {"game_id": ID, "team_id": "84", "reason": "duplicate schedule game ID"}]}
        with patch("check_cbb_finals_health.read", return_value=quarantine):
            missing, quarantined = public_calendars(
                "women", source, lambda path: published, TIP)
        self.assertEqual(missing, [ID + "/84"])
        self.assertEqual(quarantined, 1)

    def test_public_calendar_reconciliation_detects_unrelated_game(self):
        source = {ID: ("84", "153", 78, 72, TIP)}
        bogus = game(id="another-game", away="333", home="444")
        missing, quarantined = public_calendars(
            "men", source, lambda path: {"events": [bogus]}, TIP)
        self.assertEqual(missing, [ID + "/84", ID + "/153"])
        self.assertEqual(quarantined, 0)

    def test_public_calendar_reconciliation_accepts_verified_canonical_game(self):
        source = {ID: ("84", "153", 78, 72, TIP)}
        missing, quarantined = public_calendars(
            "men", source, lambda path: {"events": [game()]}, TIP)
        self.assertEqual(missing, [])
        self.assertEqual(quarantined, 0)


if __name__ == "__main__":
    unittest.main()

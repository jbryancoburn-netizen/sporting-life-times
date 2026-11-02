"""Offline per-school certification: full calendars, not game-count thresholds."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from scripts.audit_d2_publication import full_season_school_certification


def teams():
    return [
        {"id": "alpha", "name": "Alpha University", "conference": "Example Conference",
         "not_eligible_for_dii_elo": False},
        {"id": "beta", "name": "Beta College", "conference": "Example Conference",
         "not_eligible_for_dii_elo": False},
        {"id": "transition", "name": "Transition College", "conference": "Example Conference",
         "not_eligible_for_dii_elo": True},
    ]


def game(day="2026-11-20", away="alpha", home="beta", time="7:00 PM ET"):
    return {"id": f"{day}-{away}-{home}", "date": day,
            "away": away, "home": home, "start_time": time, "status": "scheduled",
            "neutral": False}


def snapshot():
    return {"gender": "men", "owner_id": "alpha",
            "source_url": "https://alpha.example.edu/sports/mens-basketball/schedule/2026-27",
            "fixtures": [{"date": "2026-11-20", "opponent": "Beta College",
                          "role": "away", "start_time": "7:00 PM ET"}]}


def attestation():
    return {"gender": "men", "owner_id": "alpha",
            "source_url": snapshot()["source_url"],
            "independent_source_url": "https://beta.example.edu/sports/mens-basketball/schedule/2026-27",
            "reviewed_by": "Verification editor",
            "checked_on": "2026-11-02",
            "snapshot_rows": 1,
            "complete_calendar": True,
            "all_eligible_games_checked": True,
            "other_division_games_reviewed": True,
            "independent_crosscheck_completed": True,
            "unresolved_tbd_count": 0}


class FullSeasonCertificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def report(self, games=None, sources=None, assertions=None):
        evidence = {
            "schema": 1, "season": "2026-27",
            "schools": [] if sources is None else sources,
            "live_school_sources": [],
            "certification_assertions": [] if assertions is None else assertions,
        }
        (self.directory / "d2-official-school-grids-2026-27.json").write_text(
            json.dumps(evidence), encoding="utf-8")
        return full_season_school_certification(
            "men", teams(), [game()] if games is None else games,
            self.directory)

    def find(self, result, name="alpha"):
        return next(x for x in result["schools"] if x["id"] == name)

    def test_even_30_published_games_cannot_self_certify(self):
        fixtures = [game(day=(dt.date(2026, 11, 1) +
                              dt.timedelta(days=i)).isoformat()) for i in range(30)]
        result = self.report(games=fixtures)
        self.assertEqual(result["eligible_schools"], 2)
        self.assertEqual(result["certified_schools"], 0)
        self.assertEqual(result["uncertified_schools"], 2)
        self.assertEqual(self.find(result)["status"],
                         "OFFICIAL_FULL_CALENDAR_REQUIRED")
        self.assertEqual(self.find(result)["published_games"], 30)

    def test_official_source_rows_alone_do_not_certify(self):
        result = self.report(sources=[snapshot()])
        alpha = self.find(result)
        self.assertEqual(alpha["status"], "COMPLETE_SEASON_ATTESTATION_REQUIRED")
        self.assertEqual(alpha["eligible_source_games"], 1)
        self.assertEqual(alpha["matched_source_games"], 1)
        self.assertEqual(alpha["published_games_not_in_source_snapshot"], 0)
        self.assertFalse(alpha["certified"])
        self.assertEqual(self.find(result, "transition")["status"],
                         "MEMBERSHIP_EXCLUDED")

    def test_explicit_full_calendar_with_independent_check_can_certify_one_school(self):
        result = self.report(sources=[snapshot()], assertions=[attestation()])
        self.assertEqual(result["certified_schools"], 1)
        self.assertEqual(result["uncertified_schools"], 1)
        alpha = self.find(result)
        self.assertTrue(alpha["certified"])
        self.assertEqual(alpha["status"], "CERTIFIED")
        self.assertFalse(self.find(result, "beta")["certified"])

    def test_date_missing_game_or_role_conflict_blocks_certification(self):
        for games in (
            [],
            [game(day="2026-11-21")],
            [game(away="beta", home="alpha")],
            [game(time="5:00 PM ET")],
        ):
            with self.subTest(games=games):
                result = self.report(games=games, sources=[snapshot()],
                                     assertions=[attestation()])
                self.assertFalse(self.find(result)["certified"])
                self.assertEqual(self.find(result)["status"],
                                 "SOURCE_LEDGER_RECONCILIATION")
        result = self.report(games=[game(), game(day="2026-11-23")],
                             sources=[snapshot()], assertions=[attestation()])
        alpha = self.find(result)
        self.assertEqual(alpha["published_games_not_in_source_snapshot"], 1)
        self.assertFalse(alpha["certified"])

    def test_wrong_season_or_unverified_crosscheck_fails(self):
        for key, value in (
            ("complete_calendar", False),
            ("independent_crosscheck_completed", False),
            ("checked_on", "2025-11-02"),
            ("independent_source_url", snapshot()["source_url"]),
            ("snapshot_rows", 30),
            ("other_division_games_reviewed", False),
            ("unresolved_tbd_count", 1),
            ("reviewed_by", ""),
        ):
            with self.subTest(key=key):
                assertion = attestation()
                assertion[key] = value
                result = self.report(sources=[snapshot()], assertions=[assertion])
                self.assertFalse(self.find(result)["certified"])
                self.assertEqual(self.find(result)["status"], "ATTESTATION_FAILED")
                self.assertTrue(self.find(result)["attestation_errors"])

    def test_unknown_or_non_dii_opponents_must_be_explicitly_classified(self):
        source = snapshot()
        source["fixtures"].append({
            "date": "2026-11-21", "opponent": "Unlisted Junior College",
            "role": "home", "start_time": "",
        })
        assertion = attestation()
        assertion["snapshot_rows"] = 2
        result = self.report(sources=[source], assertions=[assertion])
        alpha = self.find(result)
        self.assertEqual(alpha["unidentified_or_other_division_rows"], 1)
        self.assertEqual(alpha["status"], "ATTESTATION_FAILED")
        self.assertFalse(alpha["certified"])

    def test_explicitly_classified_non_dii_source_rows_can_be_excluded(self):
        source = snapshot()
        source["fixtures"].append({
            "date": "2026-11-21", "opponent": "Unlisted Junior College",
            "role": "home", "start_time": "",
        })
        assertion = attestation()
        assertion["snapshot_rows"] = 2
        assertion["other_division_classifications"] = [{
            "date": "2026-11-21",
            "opponent": "Unlisted Junior College",
            "classification": "not_dii_2026_27",
            "membership_source_url": "https://ncaa.example.org/directory/junior-college",
        }]
        result = self.report(sources=[source], assertions=[assertion])
        self.assertEqual(result["certified_schools"], 1)
        self.assertTrue(self.find(result)["certified"])
        self.assertEqual(self.find(result)["unidentified_or_other_division_rows"], 1)
        # The source is exhaustive; the non-DII matchup was NOT added
        # to the DII game ledger or Elo system.
        self.assertEqual(self.find(result)["published_games"], 1)
        incorrect = attestation()
        incorrect["snapshot_rows"] = 2
        incorrect["other_division_classifications"] = [{
            "date": "2026-11-21", "opponent": "Unlisted Junior College",
            "classification": "unresolved_identity",
            "membership_source_url": "https://ncaa.example.org/directory/junior-college",
        }]
        result = self.report(sources=[source], assertions=[incorrect])
        self.assertFalse(self.find(result)["certified"])

    def test_partial_source_is_never_full_certification(self):
        source = snapshot()
        source["scope"] = "One exact fixture only. Not a complete season."
        result = self.report(sources=[source])
        self.assertEqual(self.find(result)["status"], "PARTIAL_SOURCE_CAPTURE")
        self.assertTrue(self.find(result)["explicitly_partial_source"])
        result = self.report(sources=[source], assertions=[attestation()])
        self.assertFalse(self.find(result)["certified"])
        self.assertIn(
            "Source snapshot expressly documents only partial game coverage",
            self.find(result)["attestation_errors"])

    def test_official_snapshot_must_cover_existing_ledger_fixtures(self):
        result = self.report(
            sources=[snapshot()],
            games=[game(), game(day="2026-11-25")])
        alpha = self.find(result)
        self.assertEqual(alpha["published_games_not_in_source_snapshot"], 1)
        self.assertEqual(alpha["status"], "SOURCE_LEDGER_RECONCILIATION")
        self.assertEqual(result["outside_source_snapshot_games"], 1)
        # Only alpha has a source snapshot; beta is queued for discovery.

    def test_unresolved_postseason_tbd_is_not_a_nondii_opponent(self):
        source = snapshot()
        source["fixtures"].append({
            "date": "2027-03-03", "opponent": "Conference Tournament",
            "role": "neutral", "start_time": "",
            "unresolved_tournament_placeholder": True,
        })
        result = self.report(sources=[source])
        alpha = self.find(result)
        self.assertEqual(alpha["unresolved_tournament_placeholders"], 1)
        self.assertEqual(alpha["unidentified_or_other_division_rows"], 0)
        self.assertEqual(alpha["status"], "POSTSEASON_TBD_REVIEW_REQUIRED")
        self.assertEqual(result["unresolved_tournament_placeholders"], 1)
        assertion = attestation()
        assertion["snapshot_rows"] = 2
        assertion["unresolved_tbd_count"] = 0  # dishonest claim cannot pass
        result = self.report(sources=[source], assertions=[assertion])
        alpha = self.find(result)
        self.assertFalse(alpha["certified"])
        self.assertIn("Unresolved TBD opponents/tournament placeholders",
                      alpha["attestation_errors"])

    def test_duplicate_and_wrong_season_attestations_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.report(sources=[snapshot()],
                        assertions=[attestation(), attestation()])
        wrong = {"schema": 1, "season": "2025-26",
                 "schools": [snapshot()], "certification_assertions": []}
        (self.directory / "d2-official-school-grids-2026-27.json").write_text(
            json.dumps(wrong))
        with self.assertRaisesRegex(ValueError, "Wrong school-grid"):
            full_season_school_certification("men", teams(), [game()],
                                             self.directory)


if __name__ == "__main__":
    unittest.main()

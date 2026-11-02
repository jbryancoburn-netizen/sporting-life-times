"""Official Wayne State Detroit 2026-27 women's calendar and verified broadcast metadata."""
import datetime as dt
import json
import unittest
from pathlib import Path

from scripts.build_d2_basketball import apply_official_school_grid_snapshots

PATH = Path(__file__).resolve().parents[1] / "data" / "d2-official-school-grids-2026-27.json"


class WayneStateCompleteCalendarTests(unittest.TestCase):
    def setUp(self):
        self.grid = json.loads(PATH.read_text(encoding="utf-8"))
        self.school = next(x for x in self.grid["schools"] if x["gender"] == "women"
                           and x["owner_id"] == "wayne-state-university-michigan")

    def test_all_31_rows_from_exact_official_detroit_calendar(self):
        self.assertIn("wsuathletics.com", self.school["source_url"])
        self.assertEqual(len(self.school["fixtures"]), 31)
        self.assertEqual(len({(g["date"], g["opponent"])
                              for g in self.school["fixtures"]}), 31)
        self.assertEqual(sum(bool(g.get("unresolved_tournament_placeholder"))
                             for g in self.school["fixtures"]), 1)
        self.assertTrue(all(g.get("network") in ("FloCollege", "SSC Network")
                            for g in self.school["fixtures"]))
        self.assertTrue(all(not g.get("start_time") or
                            g["start_time"].endswith(" ET")
                            for g in self.school["fixtures"]))
        for row in self.school["fixtures"]:
            for k in ("status", "away_score", "home_score", "elo_change_away"):
                self.assertNotIn(k, row)

    def test_no_tournament_opponent_is_fabricated(self):
        tournament = self.school["fixtures"][-1]
        self.assertEqual(tournament["date"], "2027-03-03")
        self.assertEqual(tournament["opponent"], "GLIAC Tournament")
        self.assertEqual(tournament["start_time"], "")
        self.assertTrue(tournament["unresolved_tournament_placeholder"])
        self.assertFalse(any(a["gender"] == "women" and
                             a["owner_id"] == "wayne-state-university-michigan"
                             for a in self.grid.get("certification_assertions", [])))

    def test_athletics_source_provides_exact_neutral_site_and_tv(self):
        rows = self.school["fixtures"]
        self.assertEqual(next(x for x in rows if x["date"] == "2026-11-06")[
                         "venue"], "Owensboro Sportscenter · Owensboro, KY")
        self.assertEqual(next(x for x in rows if x["date"] == "2026-12-18")[
                         "venue"], "McArthur Center · St. Petersburg, FL")
        self.assertEqual(next(x for x in rows if x["date"] == "2026-12-18")[
                         "network"], "SSC Network")
        self.assertEqual(next(x for x in rows if x["date"] == "2026-12-05")[
                         "venue"], "Wayne State Fieldhouse · Detroit, MI")

    def test_existing_importer_creates_and_enriches_only_canonical_games(self):
        teams = {
            "wayne-state-university-michigan": {
                "id": "wayne-state-university-michigan",
                "name": "Wayne State University (Michigan)"},
            "carson-newman-university": {
                "id": "carson-newman-university", "name": "Carson-Newman University"},
            "grand-valley-state-university": {
                "id": "grand-valley-state-university", "name": "Grand Valley State University"},
            "truman-state-university": {
                "id": "truman-state-university", "name": "Truman State University"},
        }
        games = {}
        first = apply_official_school_grid_snapshots(
            "women", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(first["created"], 4)
        self.assertEqual(len(games), 4)
        self.assertNotIn("GLIAC Tournament", str(games))
        neutral = next(x for x in games.values()
                       if x["date"] == "2026-12-18")
        self.assertTrue(neutral["neutral"])
        self.assertEqual(neutral["network"], "SSC Network")
        self.assertEqual(neutral["venue"], "McArthur Center · St. Petersburg, FL")
        self.assertEqual(neutral["broadcast_source_url"], self.school["source_url"])
        self.assertEqual(neutral["venue_source_url"], self.school["source_url"])
        self.assertEqual(neutral["status"], "scheduled")
        self.assertIsNone(neutral["home_score"])
        second = apply_official_school_grid_snapshots(
            "women", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(second["created"], 0)
        self.assertEqual(len(games), 4)

    def test_existing_ncaa_final_is_not_changed_by_source_fixture(self):
        teams = {
            "wayne-state-university-michigan": {
                "id": "wayne-state-university-michigan",
                "name": "Wayne State University (Michigan)"},
            "carson-newman-university": {
                "id": "carson-newman-university", "name": "Carson-Newman University"},
        }
        prior = {
            "ncaafinal": {
                "id": "ncaafinal", "date": "2026-11-06",
                "away": "wayne-state-university-michigan",
                "home": "carson-newman-university", "neutral": True,
                "status": "final", "away_score": 68, "home_score": 64,
                "verified": True, "network": "",
                "source_url": "https://ncaa.com/verified-final"
            }
        }
        stats = apply_official_school_grid_snapshots(
            "women", prior, teams, dt.date(2026, 11, 2))
        self.assertEqual(stats["created"], 0)
        self.assertEqual(len(prior), 1)
        self.assertEqual(prior["ncaafinal"]["away_score"], 68)
        self.assertEqual(prior["ncaafinal"]["home_score"], 64)
        self.assertEqual(prior["ncaafinal"]["status"], "final")
        self.assertEqual(prior["ncaafinal"]["id"], "ncaafinal")


if __name__ == "__main__":
    unittest.main()

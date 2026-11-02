"""2026-27 DII three full-school calendars: exact opponent, date, role, no fake results."""
import datetime as dt
import json
import unittest
from pathlib import Path

from scripts.build_d2_basketball import apply_official_school_grid_snapshots

DATA = Path(__file__).resolve().parents[1] / "data" / "d2-official-school-grids-2026-27.json"


def calendars():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    return {school["owner_id"]: school for school in data["schools"]
            if school["gender"] == "men"}


class MenCompleteSourceCalendarTests(unittest.TestCase):
    def test_79_exact_official_dated_university_rows(self):
        entries = calendars()
        expected = {
            "d-youville": (25, "dyusaints.com"),
            "roberts-wesleyan": (25, "robertsredhawks.com"),
            "minnesota-duluth": (29, "umdbulldogs.com"),
        }
        for owner, (n, domain) in expected.items():
            source = entries[owner]
            self.assertEqual(len(source["fixtures"]), n)
            self.assertIn(domain, source["source_url"])
            self.assertEqual(len({(g["date"], g["opponent"])
                                  for g in source["fixtures"]}), n)
            for row in source["fixtures"]:
                self.assertRegex(row["date"], r"^202[67]-\d\d-\d\d$")
                self.assertIn(row["role"], {"home", "away", "neutral"})
                self.assertTrue(not row["start_time"] or row["start_time"].endswith(" ET"))
                for forbidden in ("status", "away_score", "home_score", "elo_change_home"):
                    self.assertNotIn(forbidden, row)
        self.assertEqual(sum(len(entries[name]["fixtures"]) for name in expected), 79)

    def test_reciprocal_dyouville_roberts_games_do_not_duplicate(self):
        entries = calendars()
        a = entries["d-youville"]["fixtures"]
        b = entries["roberts-wesleyan"]["fixtures"]
        for date, home in (("2027-01-30", "d-youville"),
                           ("2027-02-25", "roberts-wesleyan")):
            dyu = next(g for g in a if g["date"] == date and
                       g["opponent"] == "Roberts Wesleyan")
            rob = next(g for g in b if g["date"] == date and
                       g["opponent"] == "D'Youville")
            self.assertEqual(dyu["start_time"], rob["start_time"])
            self.assertEqual(dyu["role"] == "home", home == "d-youville")
            self.assertEqual(rob["role"] == "home", home == "roberts-wesleyan")

    def test_dyu_ambiguous_november_tournament_games_cross_checked(self):
        school = calendars()["d-youville"]
        a = next(f for f in school["fixtures"] if f["date"] == "2026-11-13")
        b = next(f for f in school["fixtures"] if f["date"] == "2026-11-14")
        self.assertEqual((a["opponent"], a["role"], a["start_time"]),
                         ("Millersville", "away", "5:00 PM ET"))
        self.assertEqual((b["opponent"], b["role"], b["start_time"]),
                         ("Mansfield", "neutral", "2:00 PM ET"))
        refs = " ".join(school["source_references"])
        self.assertIn("millersvilleathletics.com", refs)
        self.assertIn("gomounties.com", refs)

    def test_non_dii_and_missing_clocks_not_invented(self):
        entries = calendars()
        other = {f["opponent"] for owner in ("roberts-wesleyan", "minnesota-duluth")
                 for f in entries[owner]["fixtures"] if "Exhibition" in f["opponent"]
                 or "Redeemer" in f["opponent"] or "Carleton" in f["opponent"]
                 or "Superior" in f["opponent"]}
        self.assertEqual(len(other), 5)
        umd = entries["minnesota-duluth"]["fixtures"]
        for date in ("2026-11-24", "2026-12-03", "2027-02-20"):
            row = next(g for g in umd if g["date"] == date)
            self.assertEqual(row["start_time"], "")
        self.assertEqual(next(g for g in umd if g["date"] == "2027-02-06")[
                         "start_time"], "2:00 PM ET")

    def test_existing_importer_reconciles_both_dyu_roberts_dates_once(self):
        # Isolate the three owners and the two confirmed reciprocal matchups:
        # non-DII university rows are not fabricated as Elo fixtures.
        teams = {
            "d-youville": {"id": "d-youville", "name": "D'Youville"},
            "roberts-wesleyan": {
                "id": "roberts-wesleyan", "name": "Roberts Wesleyan"},
        }
        games = {}
        first = apply_official_school_grid_snapshots(
            "men", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(first["created"], 2)
        self.assertEqual(len(games), 2)
        self.assertEqual({g["date"] for g in games.values()},
                         {"2027-01-30", "2027-02-25"})
        self.assertTrue(all(g["status"] == "scheduled" and
                            g["away_score"] is None and
                            g["home_score"] is None for g in games.values()))
        second = apply_official_school_grid_snapshots(
            "men", games, teams, dt.date(2026, 11, 2))
        self.assertEqual(second["created"], 0)
        self.assertEqual(len(games), 2)

    def test_snapshot_is_not_certification_assertion(self):
        data = json.loads(DATA.read_text(encoding="utf-8"))
        attested = {(x["gender"], x["owner_id"]) for x in
                    data.get("certification_assertions", [])}
        for owner in ("d-youville", "roberts-wesleyan", "minnesota-duluth"):
            self.assertNotIn(("men", owner), attested)


if __name__ == "__main__":
    unittest.main()

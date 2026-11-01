"""Offline PSAC source, membership, tipoff and ledger-integrity regression tests."""
import datetime as dt
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import d2_psac_official as psac

ROOT = Path(__file__).resolve().parents[1]


def schedule_row(label, gender, owner, date, opponent, star="*"):
    return ("<tr><td>" + date + "</td><td>" + star +
            "</td><td>" + opponent + "</td><td>Erie, PA</td>"
            "<td>3:00 P.M.</td></tr>")


class OfficialPSACBasketball(unittest.TestCase):
    def test_34_actual_psac_2026_27_calendar_ids(self):
        self.assertEqual(set(psac.SCHEDULE_IDS["men"]), set(range(5961, 5977)) | {6034})
        self.assertEqual(set(psac.SCHEDULE_IDS["women"]), set(range(5977, 5993)) | {6033})
        for gender in ("men", "women"):
            entries = psac.SCHOOLS[gender]
            self.assertEqual(len(entries), 17)
            self.assertEqual(len({id for _, id in entries.values()}), 17)
            self.assertNotIn("lackawanna", str(entries).lower())

    def test_canonical_gender_ids_exactly_match_both_published_directories(self):
        for gender in ("men", "women"):
            path = ROOT / f"data/d2-{gender}-2026-27.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            teams = {t["id"]: t for t in data["teams"]}
            missing = [ident for _, ident in psac.SCHOOLS[gender].values() if ident not in teams]
            self.assertEqual(missing, [], "PSAC exact source IDs must match real season data")
            self.assertTrue(all(not teams[ident].get("not_eligible_for_dii_elo")
                                for _, ident in psac.SCHOOLS[gender].values()))

    def test_only_psac_aliases_never_provisional_lackawanna(self):
        self.assertEqual(psac.opponent_id("at IUP", "men"), "indiana-pa")
        self.assertEqual(psac.opponent_id("at California (Pa.)", "women"),
                         "pennsylvania-western-university-california")
        self.assertEqual(psac.opponent_id("Pitt-Johnstown", "men"), "pittsburgh-johnstown")
        for name in ("at Lackawanna", "vs. Lackawanna", "Unidentified College"):
            self.assertIsNone(psac.opponent_id(name, "men"))
        self.assertEqual(psac.eastern_tipoff("12:00 P.M."), "12:00 PM ET")
        self.assertEqual(psac.eastern_tipoff("12:00 A.M."), "12:00 AM ET")
        self.assertIsNone(psac.eastern_tipoff("TBA"))
        self.assertIsNone(psac.eastern_tipoff("8:00 M."))
        
    def test_school_calendar_strict_correct_year_and_source_identity(self):
        schedule = psac.SCHOOLS["men"][5966]
        owner = schedule[1]
        rows = "".join(
            schedule_row("Gannon", "men", owner,
                         (dt.date(2026, 12, 4) + dt.timedelta(days=i*2)).strftime("%m/%d/%Y"),
                         "at Kutztown")
            for i in range(14))
        html = ("<h2>2026-27 Gannon Men's Basketball Schedule</h2><table>"
                "<tr><th>Date</th><th>Conference Game</th><th>Opponent</th>"
                "<th>Location</th><th>Time/Result</th></tr>" + rows + "</table>")
        found = psac.parse_school_calendar(html, "men", 5966)
        self.assertEqual(len(found), 14)
        self.assertEqual(found[0]["away"], owner)
        self.assertEqual(found[0]["home"], psac.MEN_IDS[7])
        self.assertEqual(found[0]["tipoff"], "3:00 PM ET")
        with self.assertRaises(ValueError):
            psac.parse_school_calendar(html.replace("Men's", "Women's"), "men", 5966)
        with self.assertRaises(ValueError):
            psac.parse_school_calendar(html.replace("2026-27", "2025-26"), "men", 5966)

    def test_two_university_sources_create_one_game_only_with_provenance(self):
        away, home = psac.MEN_IDS[5], psac.MEN_IDS[7]
        entry = {
            "date": "2026-12-04", "away": away, "home": home,
            "tipoff": "5:00 PM ET", "city": "Kutztown, PA",
            "conference_marked": True,
        }
        a = {**entry, "source_team": away, "source_url": "https://psacsports.org/schedule.aspx?schedule=5966"}
        b = {**entry, "source_team": home, "source_url": "https://psacsports.org/schedule.aspx?schedule=5968"}
        games = {}
        summary = psac.reconcile({away: [a], home: [b]}, games, {away: {}, home: {}},
                                 dt.date(2026, 11, 1))
        self.assertEqual(summary["new_games"], 1)
        self.assertEqual(summary["reciprocal_confirmations"], 1)
        game = next(iter(games.values()))
        self.assertEqual(game["start_time"], "5:00 PM ET")
        self.assertEqual(game["psac_school_sources"], sorted([a["source_url"], b["source_url"]]))
        self.assertTrue(game["fixture_verified"])
        self.assertEqual(game["status"], "scheduled")
        self.assertNotIn("venue", game)
        self.assertNotIn("network", game)
        self.assertNotIn("stream_url", game)

    def test_conflict_missing_opponent_away_home_never_create_phantom(self):
        a, b = psac.MEN_IDS[5], psac.MEN_IDS[7]
        base = {"date": "2026-12-04", "away": a, "home": b,
                "tipoff": "5:00 PM ET", "city": "Kutztown, PA",
                "source_team": a, "source_url": "https://psacsports.org/schedule.aspx?schedule=5966"}
        reversed_home = {**base, "away": b, "home": a,
                         "source_team": b, "source_url": "https://psacsports.org/schedule.aspx?schedule=5968"}
        games = {}
        summary = psac.reconcile({a: [base], b: [reversed_home]}, games,
                                 {a: {}, b: {}}, dt.date(2026, 11, 1))
        self.assertEqual(summary["reciprocal_confirmations"], 0)
        self.assertFalse(games)
        summary = psac.reconcile({a: [base]}, {}, {a: {}, b: {}}, dt.date(2026, 11, 1))
        self.assertEqual(summary["single_sided"], 1)

    def test_existing_final_is_untouched_even_if_schedule_disagrees(self):
        a, b = psac.MEN_IDS[5], psac.MEN_IDS[7]
        game = {"id": "ncaa-unique", "date": "2026-12-04", "away": a, "home": b,
                "status": "final", "away_score": 79, "home_score": 73,
                "verified": False, "elo_eligible": True}
        before = dict(game)
        rr = [{
            "date": "2026-12-04", "away": a, "home": b,
            "source_team": owner, "source_url": "https://psacsports.org/schedule.aspx?schedule=5966",
            "tipoff": "5:00 PM ET", "city": "Kutztown, PA",
        } for owner in (a, b)]
        games = {game["id"]: game}
        report = psac.reconcile({a:[rr[0]],b:[rr[1]]}, games,
                                {a: {}, b: {}}, dt.date(2026, 11, 1))
        self.assertEqual(report["existing_games_enriched"], 1)
        self.assertEqual(game["id"], before["id"])
        self.assertEqual((game["away_score"], game["home_score"]), (79,73))
        self.assertEqual(game["verified"], False, "school schedule cannot verify a final score")
        self.assertEqual(len(games), 1)

    def test_timing_conflict_quarantined_and_missing_sources_withheld(self):
        a, b = psac.WOMEN_IDS[5], psac.WOMEN_IDS[7]
        row = {"date": "2026-12-04", "away": a, "home": b,
               "city": "Erie, PA", "source_url": "https://psacsports.org/schedule.aspx?schedule=5982"}
        games = {}
        report = psac.reconcile({a:[{**row,"source_team":a,"tipoff":"1:00 PM ET"}],
                                 b:[{**row,"source_team":b,"tipoff":"3:00 PM ET"}]},
                                games, {a:{},b:{}}, dt.date(2026,11,1))
        self.assertEqual(report["conflicting_tipoffs"], 1)
        self.assertNotIn("start_time", next(iter(games.values())))
        with patch.object(psac, "read_official_html", side_effect=OSError("offline")):
            status = psac.enrich_psac("women", {}, {team:{} for _,team in psac.SCHOOLS["women"].values()},
                                      dt.date(2026,11,1))
            self.assertIn("withheld", status["status"])
            self.assertFalse(status["reciprocal_confirmations"])


if __name__ == "__main__":
    unittest.main()

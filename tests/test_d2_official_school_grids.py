"""Official 2026-27 university school grid recovery: conservative identity / no synthetic results."""
import datetime as dt
import json
import unittest
from pathlib import Path
from scripts.build_d2_basketball import apply_official_school_grid_snapshots

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "d2-official-school-grids-2026-27.json"


class D2OfficialSchoolGrids(unittest.TestCase):
    def test_three_source_grids_are_distinct_and_have_exact_provenance(self):
        data = json.loads(DATA.read_text())
        self.assertEqual([len(x["fixtures"]) for x in data["schools"]], [27,28,28])
        for school in data["schools"]:
            self.assertTrue(school["source_url"].startswith("https://"))
            self.assertEqual(len({(x["date"], x["opponent"]) for x in school["fixtures"]}),
                             len(school["fixtures"]))
            self.assertTrue(all(x["role"] in ("home","away","neutral") for x in school["fixtures"]))

    def test_new_school_game_carries_home_venue_but_no_result(self):
        teams = {"salem":{"id":"salem","name":"Salem","slug":""},
                 "concord":{"id":"concord","name":"Concord University","slug":""}}
        games={}
        stats=apply_official_school_grid_snapshots("men",games,teams,dt.date(2026,11,1))
        self.assertEqual(stats["source_rows"],27)
        self.assertEqual(stats["created"],2)  # Salem vs Concord twice
        self.assertGreater(stats["unmatched"],0)
        first=next(x for x in games.values() if x["date"]=="2026-11-23")
        self.assertEqual(first["home"],"salem")
        self.assertIn("T. Edward Davis",first["venue"])
        self.assertEqual(first["start_time"],"6:00 PM ET")
        self.assertIsNone(first["home_score"])
        self.assertEqual(first["status"],"scheduled")

    def test_existing_canonical_final_is_not_overwritten_or_duplicated(self):
        teams={"salem":{"id":"salem","name":"Salem","slug":""},
               "concord":{"id":"concord","name":"Concord University","slug":""}}
        existing={"id":"ncaa-actual","date":"2026-11-23","away":"concord","home":"salem",
                  "status":"final","away_score":60,"home_score":63,"start_time":"",
                  "venue":"","source_url":"https://www.ncaa.com/game/123"}
        games={"ncaa-actual":existing}
        apply_official_school_grid_snapshots("men",games,teams,dt.date(2026,11,1))
        self.assertEqual(len([x for x in games.values() if x["date"]=="2026-11-23"]),1)
        self.assertEqual((existing["away_score"],existing["home_score"]),(60,63))
        self.assertEqual(existing["status"],"final")
        self.assertEqual(existing["start_time"],"6:00 PM ET")
        self.assertEqual(existing["source_url"],"https://www.ncaa.com/game/123")

    def test_non_dii_opponent_never_becomes_eligible_fixture(self):
        teams={"lincoln-university-pennsylvania":{"id":"lincoln-university-pennsylvania","name":"Lincoln University (Pennsylvania)","slug":""},
               "fayetteville-state":{"id":"fayetteville-state","name":"Fayetteville State University","slug":""}}
        games={}
        counts=apply_official_school_grid_snapshots("women",games,teams,dt.date(2026,11,1))
        self.assertEqual(len([x for x in games.values() if x["date"]=="2026-11-11"]),0)
        self.assertEqual(len([x for x in games.values() if x["date"]=="2027-01-12"]),0)
        self.assertEqual(len([x for x in games.values() if x["date"]=="2026-12-03"]),1)
        self.assertGreater(counts["unmatched"],0)


if __name__ == "__main__":
    unittest.main()

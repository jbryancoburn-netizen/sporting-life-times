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
        self.assertEqual([len(x["fixtures"]) for x in data["schools"]], [27,28,28,28])
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


    def test_charleston_2026_women_28_official_rows_and_guardrails(self):
        evidence=json.loads(DATA.read_text())
        school=next(s for s in evidence["schools"] if
                    s["owner_id"]=="university-of-charleston-west-virginia")
        self.assertEqual(len(school["fixtures"]),28)
        self.assertTrue(all(x["date"]>="2026-11-09" for x in school["fixtures"]))
        self.assertEqual(school["home_venue"],"Wehrle Innovation Center · Charleston, WV")
        teams={
            "university-of-charleston-west-virginia":{
                "id":"university-of-charleston-west-virginia",
                "name":"University of Charleston (West Virginia)","slug":""},
            "fairmont-state-university":{
                "id":"fairmont-state-university","name":"Fairmont State University","slug":""},
            "west-virginia-wesleyan-college":{
                "id":"west-virginia-wesleyan-college","name":"West Virginia Wesleyan College","slug":""},
        }
        games={}
        first=apply_official_school_grid_snapshots("women",games,teams,dt.date(2026,11,1))
        self.assertEqual(first["created"],4)
        self.assertEqual(first["source_rows"],28)  # Only enrolled source owners count
        fairmont=[g for g in games.values() if "fairmont-state-university" in
                  (g["away"],g["home"])]
        self.assertEqual(len(fairmont),2)
        home=next(g for g in fairmont if g["date"]=="2026-12-02")
        self.assertIn("Wehrle Innovation Center",home["venue"])
        self.assertEqual(home["home"],"university-of-charleston-west-virginia")
        self.assertEqual(home["start_time"],"5:30 PM ET")
        self.assertEqual(home["status"],"scheduled")
        self.assertIsNone(home["home_score"])
        second=apply_official_school_grid_snapshots("women",games,teams,dt.date(2026,11,1))
        self.assertEqual(second["created"],0)
        self.assertEqual(len(games),4)


    def test_wrong_time_zone_school_evidence_is_rejected(self):
        import tempfile
        entry = {
            "gender": "men", "owner_id": "salem",
            "source_url": "https://salemtigers.com/sports/mens-basketball/schedule",
            "home_venue": "T. Edward Davis Gymnasium",
            "fixtures": [{
                "date": "2027-01-01", "role": "home",
                "opponent": "Concord University",
                "start_time": "7:00 PM PT"
            }]
        }
        teams = {
            "salem": {"id": "salem", "name": "Salem"},
            "concord": {"id": "concord", "name": "Concord University"}
        }
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "official-grid.json"
            path.write_text(json.dumps({
                "schema": 1, "season": "2026-27", "schools": [entry]
            }), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "normalized to ET"):
                apply_official_school_grid_snapshots(
                    "men", {}, teams, dt.date(2026, 11, 1),
                    registry_file=path)

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

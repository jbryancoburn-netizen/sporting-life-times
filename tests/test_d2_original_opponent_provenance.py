"""School-calendar import preserves literal source names without changing DII identities."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from scripts.build_d2_basketball import apply_official_school_grid_snapshots


class SourceOriginalOpponentTests(unittest.TestCase):
    def test_preserves_original_label_for_new_and_matched_games(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/"grids.json"
            p.write_text(json.dumps({
                "season":"2026-27","schema":1,"schools":[{
                    "gender":"men","owner_id":"anderson",
                    "source_url":"https://autrojans.com/sports/mens-basketball/schedule/2026-27?grid=true",
                    "fixtures":[
                        {"date":"2027-01-02","role":"home","opponent":"Newberry",
                         "source_opponent":"Newberry College","start_time":"4:00 PM ET"},
                        {"date":"2027-01-03","role":"away","opponent":"Newberry",
                         "source_opponent":"Newberry Wolves","start_time":""}
                    ]
                }],"live_school_sources":[],"certification_assertions":[]
            }), encoding="utf-8")
            teams={"anderson":{"id":"anderson","name":"Anderson","slug":"anderson"},
                   "newberry":{"id":"newberry","name":"Newberry","slug":"newberry"}}
            games={"existing":{"id":"existing","date":"2027-01-03","away":"anderson",
                               "home":"newberry","status":"scheduled","verified":False,
                               "start_time":"","venue":"","network":""}}
            result=apply_official_school_grid_snapshots(
                "men",games,teams,today=dt.date(2026,11,5),
                registry_file=p,live_sources=False)
            self.assertEqual(result["created"],1)
            self.assertEqual(result["matched"],1)
            bydate={g["date"]:g for g in games.values()}
            for date,original in (("2027-01-02","Newberry College"),
                                  ("2027-01-03","Newberry Wolves")):
                self.assertEqual(bydate[date]["official_source_opponent_label"],original)
                self.assertIn("autrojans.com",bydate[date]["official_source_opponent_url"])
                self.assertEqual({bydate[date]["away"],bydate[date]["home"]},
                                 {"anderson","newberry"})
            self.assertEqual(games["existing"]["id"],"existing")


if __name__=="__main__":
    unittest.main()

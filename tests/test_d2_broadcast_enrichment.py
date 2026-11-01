import datetime as dt
import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("d2_broadcasts",ROOT/"scripts"/"build_d2_basketball.py")
builder=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)

class D2BroadcastEnrichmentTests(unittest.TestCase):
    def test_cwu_source_is_18_distinct_organizer_confirmed_streams(self):
        data=json.loads((ROOT/"data"/"d2-cwu-official-tipoff-streams-2026.json").read_text())
        self.assertEqual(len(data["games"]),18)
        for gender in ("men","women"):
            items=[g for g in data["games"] if g["gender"]==gender]
            self.assertEqual(len(items),9)
            self.assertEqual(len({(g["date"],frozenset((g["away"],g["home"]))) for g in items}),9)
            self.assertTrue(all(g["network"]=="GNAC Network" for g in items))
            self.assertTrue(all(g["broadcast_type"]=="Streaming (PPV)" for g in items))
            self.assertTrue(all(g["stream_url"].startswith("https://www.gnacnetwork.com/cwuwildcats/?B=") for g in items))

    def test_official_schedule_enriches_existing_id_score_provenance(self):
        games={"d2opening-2026-men-12":{"id":"d2opening-2026-men-12",
            "date":"2026-11-01","away":"lubbock-christian","home":"central-washington",
            "status":"final","away_score":76,"home_score":82,"neutral":False,
            "source_url":"https://lcuchaps.com/sports/mens-basketball/schedule/2026-27?grid=true",
            "start_time":"","network":""}}
        data=json.loads((ROOT/"data"/"d2-cwu-official-tipoff-streams-2026.json").read_text())
        teams={x:{"id":x} for g in data["games"] for x in (g["away"],g["home"])}
        result=builder.apply_official_tipoff_streams("men",games,teams,dt.date(2026,11,1))
        game=games["d2opening-2026-men-12"]
        self.assertEqual(game["start_time"],"6:00 PM ET")
        self.assertEqual(game["network"],"GNAC Network")
        self.assertEqual(game["status"],"final")
        self.assertEqual((game["away_score"],game["home_score"]),(76,82))
        self.assertIn("lcuchaps.com",game["source_url"])
        self.assertTrue(game["stream_url"].endswith("4094010"))
        self.assertEqual(result["verified"],3)
        self.assertEqual(result["new_fixtures"],2)

    def test_missing_prior_day_final_is_recovered_only_from_official_score(self):
        evidence=json.loads((ROOT/"data"/"d2-cwu-official-tipoff-streams-2026.json").read_text())
        teams={key:{"id":key} for item in evidence["games"] for key in (item["away"],item["home"])}
        games={}
        stats=builder.apply_official_tipoff_streams("women",games,teams,dt.date(2026,11,1))
        match=[g for g in games.values() if
            g["date"]=="2026-10-31" and
            frozenset((g["away"],g["home"]))==
            frozenset(("montana-state-university-billings","minnesota-state-university-moorhead"))]
        self.assertEqual(len(match),1)
        g=match[0]
        self.assertEqual(g["status"],"final")
        self.assertEqual((g["away_score"],g["home_score"]),(56,61))
        self.assertEqual(g["start_time"],"12:00 PM ET")
        self.assertIn("wildcatsports.com",g["source_url"])
        self.assertTrue(g["elo_eligible"])
        self.assertEqual(stats["unmatched_past"],5)
        games2={g["id"]:g}
        stats2=builder.apply_official_tipoff_streams("women",games2,teams,dt.date(2026,11,1))
        self.assertEqual(stats2["updated"],1)
        self.assertEqual(len([v for v in games2.values() if v["date"]=="2026-10-31"]),1)

    def test_conflicting_official_final_is_not_silently_overwritten(self):
        fixture={"id":"ncaa-verified","date":"2026-10-31",
            "away":"montana-state-university-billings",
            "home":"minnesota-state-university-moorhead","status":"final",
            "away_score":61,"home_score":56}
        evidence=json.loads((ROOT/"data"/"d2-cwu-official-tipoff-streams-2026.json").read_text())
        teams={key:{"id":key} for item in evidence["games"] for key in (item["away"],item["home"])}
        with self.assertRaisesRegex(RuntimeError,"Conflicting verified CWU final"):
            builder.apply_official_tipoff_streams("women",{"ncaa-verified":fixture},
                teams,dt.date(2026,11,1))

    def test_november_1_dst_and_source_stamps(self):
        self.assertEqual(builder.display_et_time("2026-11-01T19:00:00Z"),"2:00 PM ET")
        self.assertEqual(builder.display_et_time("2026-11-01T23:00:00Z"),"6:00 PM ET")
        self.assertEqual(builder.display_et_time("7:00 PM ET"),"7:00 PM ET")

    def test_espn_is_secondary_network_only_and_retains_ncaa_game(self):
        rec={"id":"111","date":"2026-11-01","away":"adams-state","home":"lake-erie",
             "status":"scheduled","start_time":"","network":"","source_url":"https://www.ncaa.com/game/111"}
        records=[(rec,{"name":"Adams State"},{"name":"Lake Erie"})]
        event={"id":"555","date":"2026-11-01T22:00:00Z",
            "competitions":[{"neutralSite":True,"broadcasts":[{"names":["ESPN+"]}],
                "competitors":[{"homeAway":"away","team":{"location":"Lake Erie"}},
                               {"homeAway":"home","team":{"location":"Adams State"}}]}]}
        with patch.object(builder,"get_json",return_value={"events":[event]}):
            builder.enrich_published_details_from_espn(records,"https://example.org/espn","men","2026/11/01")
        self.assertEqual(rec["id"],"111")
        self.assertEqual(rec["source_url"],"https://www.ncaa.com/game/111")
        self.assertEqual(rec["network"],"ESPN+")
        self.assertEqual(rec["start_time"],"5:00 PM ET")

if __name__=="__main__":
    unittest.main()

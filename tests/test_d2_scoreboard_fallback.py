import datetime as dt
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE=Path(__file__).resolve().parents[1]/"scripts"/"build_d2_basketball.py"
spec=importlib.util.spec_from_file_location("d2_score_fallback",SOURCE)
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class ESPNScoreboardFallbackTests(unittest.TestCase):
    def test_empty_ncaa_feeds_check_espn_dii_and_parse_neutral_final(self):
        event={"id":"401701000","date":"2026-11-01T22:00:00Z",
         "status":{"type":{"completed":True,"state":"post"}},
         "competitions":[{"neutralSite":True,
           "venue":{"fullName":"Tournament Arena"},
           "competitors":[
             {"homeAway":"away","score":"79","team":{"id":"101","location":"Adams State"}},
             {"homeAway":"home","score":"71","team":{"id":"102","location":"Lake Erie"}}]}]}
        def get(url):
            if "sdataprod" in url:return {"data":{"contests":[]}}
            if "henrygd.me/scoreboard" in url:return {"games":[]}
            self.assertIn("groups=51",url)
            self.assertIn("dates=20261101",url)
            return {"events":[event]}
        with patch.object(builder,"get_json",side_effect=get):
            items,source=builder.fetch_day("men",dt.date(2026,11,1))
        self.assertEqual(len(items),1)
        self.assertIn("ESPN",source)
        g,a,h=items[0]
        self.assertEqual(g["status"],"final")
        self.assertEqual((g["away_score"],g["home_score"]),(79,71))
        self.assertTrue(g["neutral"])
        self.assertEqual((a["name"],h["name"]),("Adams State","Lake Erie"))
        self.assertFalse(a["d2_confirmed"])
        self.assertFalse(h["d2_confirmed"])
        registry={"adams-state":{"name":"Adams State","slug":"adams-st"},
                  "lake-erie":{"name":"Lake Erie","slug":"lake-erie"}}
        lookup=builder.build_dii_team_lookup(registry)
        self.assertEqual(builder.resolve_dii_team_id(a,lookup),"adams-state")
        self.assertEqual(builder.resolve_dii_team_id(h,lookup),"lake-erie")

    def test_no_feed_returns_valid_empty_without_invented_results(self):
        def get(url):
            if "sdataprod" in url:return {"data":{"contests":[]}}
            if "henrygd.me/scoreboard" in url:raise OSError("not available")
            return {"events":[]}
        with patch.object(builder,"get_json",side_effect=get):
            items,source=builder.fetch_day("women",dt.date(2026,11,1))
        self.assertEqual(items,[])
        self.assertIn("no games",source)

    def test_cross_division_and_nonmember_match_not_eligible(self):
        directory={"adams-state":{"name":"Adams State","slug":"adams-st"},
                   "loyola-university-new-orleans":{"name":"Loyola University New Orleans",
                     "slug":"","not_eligible_for_dii_elo":True}}
        lookup=builder.build_dii_team_lookup(directory)
        self.assertIsNone(builder.resolve_dii_team_id({"name":"Loyola University New Orleans"},lookup))
        self.assertIsNone(builder.resolve_dii_team_id({"name":"Unknown Division III University"},lookup))

if __name__=="__main__":unittest.main()

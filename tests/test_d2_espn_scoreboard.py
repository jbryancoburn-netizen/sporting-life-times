import datetime as dt
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location(
    "d2_espn_scoreboard",Path(__file__).resolve().parents[1]/"scripts"/"build_d2_basketball.py"
)
builder=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)

def espn_game():
    return {"id":"402999999","date":"2026-11-07T22:00:00Z",
        "status":{"type":{"completed":True,"state":"post"}},
        "competitions":[{"neutralSite":True,"competitors":[
            {"homeAway":"away","team":{"location":"Adams State"},"score":"86"},
            {"homeAway":"home","team":{"location":"Lake Erie"},"score":"80"}]}]}

class D2ESPNScoreboardTests(unittest.TestCase):
    def test_normalize_score_and_neutral_status(self):
        game,away,home=builder.normalise_espn_game(espn_game(),"2026/11/07","men")
        self.assertEqual(game["away_score"],86)
        self.assertEqual(game["home_score"],80)
        self.assertEqual(game["status"],"final")
        self.assertTrue(game["neutral"])
        self.assertIn("espn.com",game["source_url"])
        self.assertEqual(away["name"],"Adams State")
        self.assertEqual(home["name"],"Lake Erie")

    def test_espn_used_when_both_ncaa_feeds_empty(self):
        def get(url):
            if "sdataprod.ncaa.com" in url:return {"data":{"contests":[]}}
            if "ncaa-api.henrygd.me" in url:return {"games":[]}
            if "scoreboard" in url and "groups=51" in url:return {"events":[espn_game()]}
            raise AssertionError("Wrong provider or group "+url)
        with patch.object(builder,"get_json",side_effect=get):
            results,provider=builder.fetch_day("men",dt.date(2026,11,7))
        self.assertEqual(provider,"ESPN Division II scoreboard")
        self.assertEqual(len(results),1)

    def test_quarantine_unknown_cross_division_opponent(self):
        ids=builder.build_dii_team_lookup({"adams":{"name":"Adams State","slug":"adams-st"}})
        game,away,home=builder.normalise_espn_game(espn_game(),"2026/11/07","men")
        self.assertEqual(builder.resolve_dii_team_id(away,ids),"adams")
        self.assertIsNone(builder.resolve_dii_team_id(home,ids))

    def test_empty_ncaa_and_empty_espn_succeeds_without_inventing_games(self):
        def get(url):
            if "sdataprod.ncaa.com" in url:return {"data":{"contests":[]}}
            if "ncaa-api.henrygd.me" in url:return {"games":[]}
            return {"events":[]}
        with patch.object(builder,"get_json",side_effect=get):
            games,provider=builder.fetch_day("women",dt.date(2026,11,7))
        self.assertEqual(games,[])
        self.assertIn("no games",provider)
if __name__=="__main__":
    unittest.main()

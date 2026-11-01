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

    def test_nonempty_first_feed_does_not_hide_other_source_fixtures(self):
        """The key regression: 1 NCAA game cannot mask 2 other DII games."""
        def school(name, home):
            return {"isHome":home,"nameShort":name,"seoname":name.lower().replace(" ","-"),
                    "division":2}
        official={"contestId":"n-100","gameState":"P","teams":[school("Adams State",False),
                                                                   school("Lake Erie",True)]}
        mirror_duplicate={"game":{"gameID":"m-100","gameState":"pre",
                                   "away":{"nameShort":"Adams State","seoname":"adams-state","division":2},
                                   "home":{"nameShort":"Lake Erie","seoname":"lake-erie","division":2}}}
        mirror_additional={"game":{"gameID":"m-200","gameState":"pre",
                                   "away":{"nameShort":"Augusta","seoname":"augusta","division":2},
                                   "home":{"nameShort":"Anderson","seoname":"anderson","division":2}}}
        espn={"id":"e-300","date":"2026-11-07T17:00:00Z",
              "status":{"type":{"state":"pre"}},
              "competitions":[{"competitors":[
                  {"homeAway":"away","team":{"location":"Fort Hays State"}},
                  {"homeAway":"home","team":{"location":"Flagler"}}]}]}
        called=[]
        def sources(url):
            called.append(url)
            if "sdataprod" in url:return {"data":{"contests":[official]}}
            if "henrygd.me" in url:return {"games":[mirror_duplicate,mirror_additional]}
            if "scoreboard" in url and "groups=51" in url:return {"events":[espn]}
            raise ValueError("unexpected source "+url)
        with patch.object(builder,"get_json",side_effect=sources):
            items,provenance=builder.fetch_day("men",dt.date(2026,11,7))
        self.assertEqual(len(called),3,"all independent sources must be consulted")
        self.assertEqual(len(items),4,"a partial first NCAA source cannot suppress two more games")
        self.assertIn("NCAA official GraphQL",provenance)
        self.assertIn("NCAA open scoreboard mirror",provenance)
        self.assertIn("ESPN Division II scoreboard",provenance)
        self.assertEqual(items[0][0]["source_provider"],"NCAA official GraphQL")
        self.assertEqual(items[-1][0]["source_provider"],"ESPN Division II scoreboard")
        by_id={x["id"]:{
            "id":x["id"],"name":x["name"],"slug":x["id"]
        } for x in [
            {"id":"adams-state","name":"Adams State"},
            {"id":"lake-erie","name":"Lake Erie"},
            {"id":"augusta","name":"Augusta"},
            {"id":"anderson","name":"Anderson"},
            {"id":"fort-hays-state","name":"Fort Hays State"},
            {"id":"flagler","name":"Flagler"}]}
        lookup=builder.build_dii_team_lookup(by_id)
        ledger={}
        statuses=[]
        for event,away,home in items:
            aid=builder.resolve_dii_team_id(away,lookup)
            hid=builder.resolve_dii_team_id(home,lookup)
            self.assertTrue(aid and hid)
            statuses.append(builder.merge_ncaa_contest(ledger,event,aid,hid))
        self.assertEqual(len(ledger),3,"duplicate NCAA/mirror matchup must not be counted twice")
        self.assertEqual(statuses.count("added"),3)
        self.assertIn("updated",statuses)
        self.assertEqual(sum(g["source_provider"].startswith("ESPN") for g in ledger.values()),1)

    def test_independently_reported_provider_ids_and_official_network_survive_merge(self):
        games={"school-match":{"id":"school-match","date":"2026-11-07",
                "away":"adams-state","home":"lake-erie","status":"scheduled",
                "away_score":None,"home_score":None,"network":"University Stream",
                "source_url":"https://school.example/official","verified":True}}
        espn={"id":"espn-d2-999","date":"2026-11-07","status":"scheduled",
              "away_score":None,"home_score":None,"network":"ESPN+",
              "source_provider":"ESPN Division II scoreboard"}
        result=builder.merge_ncaa_contest(games,espn,"adams-state","lake-erie")
        self.assertEqual(result,"updated")
        game=games["school-match"]
        self.assertEqual(game["network"],"University Stream","secondary source must not overwrite official network")
        self.assertEqual(game["espn_id"],"espn-d2-999")
        self.assertNotIn("ncaa_id",game,"ESPN events must not masquerade as NCAA IDs")
        self.assertEqual(game["source_url"],"https://school.example/official")

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

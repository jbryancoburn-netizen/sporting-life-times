"""Deterministic tests for EuroLeague Elo input validation and scoring."""
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("el",pathlib.Path(__file__).with_name("euroleague_model.py"))
el=importlib.util.module_from_spec(spec)
spec.loader.exec_module(el)

def make_game(n,played=True):
    return {"gameCode":n,"utcDate":"2026-10-01T19:00:00Z","played":played,
            "local":{"club":{"code":"AAA","name":"Home","images":{"crest":"https://example.com/a.png"}},"score":80 if played else None},
            "road":{"club":{"code":"BBB","name":"Road"},"score":75 if played else None}}

class TestModel(unittest.TestCase):
    def test_even_elo(self):
        self.assertAlmostEqual(el.expected(0),0.5)
        self.assertAlmostEqual(el.expected(400),10/11)
        self.assertAlmostEqual(el.expected(-400),1/11)
    def test_parser_finals(self):
        games=el.parse({"data":[make_game(1),make_game(2,False)],"total":2},"E2026")
        self.assertTrue(games[0]["completed"])
        self.assertFalse(games[1]["completed"])
        self.assertEqual(games[0]["home"]["code"],"AAA")
        self.assertEqual(games[0]["away"]["score"],75)
    def test_fail_closed_on_bad_score(self):
        g=make_game(1);g["road"]["score"]=80
        with self.assertRaises(ValueError):el.parse({"data":[g]},"E2026")
    def test_reject_final_without_date(self):
        game=make_game(3)
        game.pop("utcDate")
        with self.assertRaises(ValueError):
            el.parse({"data":[game]},"E2026")
    def test_reject_final_with_invalid_date(self):
        game=make_game(4)
        game["utcDate"]="invalid"
        with self.assertRaises(ValueError):
            el.parse({"data":[game]},"E2026")
    def test_reject_partial_page(self):
        with self.assertRaises(ValueError):el.parse({"total":2,"data":[make_game(1)]},"E2026")
    def test_home_advantage_probability(self):
        self.assertGreater(el.expected(65),0.5)
        self.assertLess(el.expected(-65),0.5)
    def test_historical_backtest(self):
        import euroleague_backtest as bt
        g1=el.parse({"data":[make_game(1)]},"E2025")[0]
        g2=el.parse({"data":[make_game(2)]},"E2026")[0]
        result=bt.score([g1,g2],22.,65.,.67)
        self.assertEqual(result["n"],2)
        self.assertGreaterEqual(result["brier"],0)
        self.assertLessEqual(result["brier"],1)
        self.assertGreater(result["log_loss"],0)
        self.assertAlmostEqual(result["predictions"][0]["pred"],el.expected(65))
        self.assertNotAlmostEqual(result["predictions"][1]["pred"],el.expected(65))
    def test_publish_full_model_from_mocked_seasons(self):
        teams=["T"+str(i).zfill(2) for i in range(18)]
        def season_games(season):
            games=[]
            for i in range(9):
                a,b=teams[2*i],teams[2*i+1]
                games.append({"id":str(i+1),"season":season,"date":season[1:]+"-10-01T19:00:00Z",
                              "home":{"code":a,"name":a,"logo":None,"score":81},
                              "away":{"code":b,"name":b,"logo":None,"score":75},
                              "completed":True,"neutral":False})
            return games
        with tempfile.TemporaryDirectory() as tmp:
            out=pathlib.Path(tmp)/"model.json"
            with patch.object(el,"fetch_season",side_effect=season_games),patch.object(el,"OUT",out):
                el.main()
                import json
                model=json.loads(out.read_text())
                self.assertEqual(model["games_completed"],9)
                self.assertEqual(len(model["standings"]),18)
                self.assertEqual(sum(row["wins"] for row in model["standings"]),9)
                self.assertEqual(sum(row["losses"] for row in model["standings"]),9)
                self.assertEqual(len(model["rankings"]),18)
                el.main()
                self.assertEqual(json.loads(out.read_text())["games_completed"],9)
    def test_fetch_pages(self):
        def responder(url):
            if "offset=0" in url:return {"total":2,"data":[make_game(1)]}
            return {"total":2,"data":[make_game(2)]}
        with patch.object(el,"get",side_effect=responder):
            self.assertEqual(len(el.fetch_season("E2026")),2)
    def test_reject_repeated_api_pages(self):
        calls=[]
        def repeated(url):
            calls.append(url)
            return {"total":3,"data":[make_game(1)]}
        with patch.object(el,"get",side_effect=repeated):
            with self.assertRaisesRegex(ValueError,"pagination repeated"):
                el.fetch_season("E2026")
        self.assertEqual(len(calls),2)
    def test_primary_api_falls_back_to_mirror(self):
        import io, json, urllib.error
        visited=[]
        class Response:
            def __init__(self,content):self.stream=io.BytesIO(content)
            def __enter__(self):return self.stream
            def __exit__(self,*args):return False
        def opener(request,timeout=25):
            visited.append(request.full_url)
            if "api-live.euroleague.net" in request.full_url:
                raise urllib.error.URLError("primary unavailable")
            return Response(json.dumps({"data":[make_game(1)]}).encode())
        with patch.object(el.urllib.request,"urlopen",side_effect=opener), patch.object(el.time,"sleep"):
            result=el.get(el.BASE+"E2026/games?limit=1&offset=0")
        self.assertEqual(len(result["data"]),1)
        self.assertTrue(any("feeds.incrowdsports.com/provider/euroleague-feeds/v2/" in x for x in visited))
    def test_fail_empty(self):
        with self.assertRaises(ValueError):el.parse({"data":[]},"E2026")

if __name__=="__main__":unittest.main()

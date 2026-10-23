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
    def test_euroleague_wins_outrank_win_percentage(self):
        rows=[{"code":"A","name":"A","played":6,"wins":5,"losses":1,"for":480,"against":450},
              {"code":"B","name":"B","played":5,"wins":4,"losses":1,"for":420,"against":380}]
        self.assertEqual([r["code"] for r in el.order_standings(rows,[])],["A","B"])
    def test_euroleague_fewer_games_wins_tie(self):
        rows=[{"code":"A","name":"A","played":7,"wins":5,"losses":2,"for":600,"against":480},
              {"code":"B","name":"B","played":6,"wins":5,"losses":1,"for":495,"against":465}]
        self.assertEqual([r["code"] for r in el.order_standings(rows,[])],["B","A"])
    def test_euroleague_partial_meetings_use_point_difference(self):
        rows=[{"code":"A","name":"A","played":4,"wins":3,"losses":1,"for":320,"against":305},
              {"code":"B","name":"B","played":4,"wins":3,"losses":1,"for":325,"against":300}]
        games=[{"home":"A","away":"B","score":[90,70]}]
        self.assertEqual([r["code"] for r in el.order_standings(rows,games)],["B","A"])
    def test_euroleague_completed_head_to_head(self):
        rows=[{"code":"A","name":"A","played":4,"wins":3,"losses":1,"for":340,"against":330},
              {"code":"B","name":"B","played":4,"wins":3,"losses":1,"for":330,"against":300}]
        games=[{"home":"A","away":"B","score":[91,82]},
               {"home":"B","away":"A","score":[86,89]}]
        self.assertEqual([r["code"] for r in el.order_standings(rows,games)],["A","B"])
    def test_header_completed_game_updates_model_once(self):
        import datetime
        now=datetime.datetime(2026,10,23,21,5,tzinfo=datetime.timezone.utc)
        g={"id":"70","date":"2026-10-23T18:15:00Z",
           "home":{"code":"OLY","score":None},
           "away":{"code":"ULK","score":None},
           "completed":False}
        data={"Live":False,"CodeTeamA":"OLY","CodeTeamB":"ULK",
              "ScoreA":61,"ScoreB":64,"ScoreQuarter4A":61,
              "ScoreQuarter4B":64,"RemainingPartialTime":"00:00"}
        with patch.object(el.header,"get_header",return_value=data):
            self.assertEqual(el.recover_recent_header_finals([g],now),["70"])
            self.assertEqual(el.recover_recent_header_finals([g],now),[])
        self.assertTrue(g["completed"])
        self.assertEqual((g["home"]["score"],g["away"]["score"]),(61,64))
    def test_header_partial_score_does_not_finish_game(self):
        import datetime
        now=datetime.datetime(2026,10,23,21,5,tzinfo=datetime.timezone.utc)
        g={"id":"70","date":"2026-10-23T18:15:00Z",
           "home":{"code":"OLY","score":34},
           "away":{"code":"ULK","score":24},
           "completed":False}
        data={"Live":False,"CodeTeamA":"OLY","CodeTeamB":"ULK",
              "ScoreA":34,"ScoreB":24,"RemainingPartialTime":"00:00"}
        with patch.object(el.header,"get_header",return_value=data):
            self.assertEqual(el.recover_recent_header_finals([g],now),[])
        self.assertFalse(g["completed"])
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
    def test_score_model_does_not_score_before_five_games(self):
        import euroleague_backtest as bt
        games=[]
        for i in range(5):
            g=el.parse({"data":[make_game(i+1)]},"E2026")[0]
            g["date"]=f"2026-10-{i+1:02d}T19:00:00Z"
            games.append(g)
        result=bt.score_forecast_evaluation(games)
        self.assertEqual(result["games_evaluated"],0)
        g=el.parse({"data":[make_game(6)]},"E2026")[0]
        g["date"]="2026-10-06T19:00:00Z"
        result=bt.score_forecast_evaluation(games+[g])
        self.assertEqual(result["games_evaluated"],1)
        self.assertIsNotNone(result["total_mae"])
        self.assertIsNotNone(result["league_average_total_mae"])
        self.assertIsNotNone(result["zero_margin_baseline_mae"])
        self.assertIsInstance(result["beats_simple_total_baseline"],bool)
    def test_heldout_elo_evaluation_is_season_separated(self):
        import euroleague_backtest as bt
        games=[]
        for season in ("E2024","E2025","E2026"):
            for i in range(3):
                g=el.parse({"data":[make_game(i+1)]},season)[0]
                g["date"]=f"{season[1:]}-10-{i+1:02d}T19:00:00Z"
                games.append(g)
        result=bt.heldout_evaluation(games)
        self.assertEqual(result["training_season"],"E2025")
        self.assertEqual(result["holdout_season"],"E2026")
        self.assertEqual(result["selected_holdout"]["n"],3)
        self.assertEqual(result["baseline_holdout"]["n"],3)
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
    def test_completed_game_is_not_double_counted(self):
        import json
        teams=["T"+str(i).zfill(2) for i in range(18)]
        def season(season):
            rows=[]
            for i in range(9):
                rows.append({"id":str(i+1),"season":season,"date":"2026-10-01T19:00:00Z",
                  "home":{"code":teams[2*i],"name":teams[2*i],"logo":None,"score":81},
                  "away":{"code":teams[2*i+1],"name":teams[2*i+1],"logo":None,"score":75},
                  "completed":True,"neutral":False})
            if season=="E2026":
                rows.append({"id":"10","season":season,"date":"2026-10-02T19:00:00Z",
                  "home":{"code":teams[0],"name":teams[0],"logo":None,"score":90},
                  "away":{"code":teams[1],"name":teams[1],"logo":None,"score":87},
                  "completed":True,"neutral":False})
            return rows
        with tempfile.TemporaryDirectory() as tmp:
            target=pathlib.Path(tmp)/"out.json"
            with patch.object(el,"fetch_season",side_effect=season),patch.object(el,"OUT",target):
                el.main()
                first=json.loads(target.read_text())
                el.main()
                second=json.loads(target.read_text())
            self.assertEqual(first["games_completed"],10)
            self.assertEqual(second["games_completed"],10)
            self.assertEqual(first["rankings"],second["rankings"])
            self.assertEqual(sum(r["played"] for r in second["standings"]),20)
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

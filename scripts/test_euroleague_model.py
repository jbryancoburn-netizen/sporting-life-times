"""Deterministic tests for EuroLeague Elo input validation and scoring."""
import importlib.util
import pathlib
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
    def test_reject_partial_page(self):
        with self.assertRaises(ValueError):el.parse({"total":2,"data":[make_game(1)]},"E2026")
    def test_home_advantage_probability(self):
        self.assertGreater(el.expected(65),0.5)
        self.assertLess(el.expected(-65),0.5)
    def test_fetch_pages(self):
        def responder(url):
            if "offset=0" in url:return {"total":2,"data":[make_game(1)]}
            return {"total":2,"data":[make_game(2)]}
        with patch.object(el,"get",side_effect=responder):
            self.assertEqual(len(el.fetch_season("E2026")),2)
    def test_fail_empty(self):
        with self.assertRaises(ValueError):el.parse({"data":[]},"E2026")

if __name__=="__main__":unittest.main()

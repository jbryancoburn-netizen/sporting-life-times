"""Offline validation for live EuroLeague scorebug classification and data safety."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

path=pathlib.Path(__file__).with_name("euroleague_live.py")
spec=importlib.util.spec_from_file_location("euroleague_live",path)
live=importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)

def game(i,when="2026-10-23T18:15:00Z",status="Confirmed",played=False,score=None):
    return {"gameCode":i,"utcDate":when,"gameStatus":status,"played":played,
            "local":{"club":{"code":"AAA","name":"Home"},"score":score},
            "road":{"club":{"code":"BBB","name":"Away"},"score":score}}

class TestLiveScorebugs(unittest.TestCase):
    def test_explicit_statuses(self):
        self.assertEqual(live.live_status(game(1,status="Confirmed")),"scheduled")
        self.assertEqual(live.live_status(game(1,status="Playing")),"live")
        self.assertEqual(live.live_status(game(1,status="Final")),"final")
        self.assertEqual(live.live_status(game(1,played=True)),"final")
    def test_scheduled_zero_is_not_score(self):
        row=game(1,score=0)
        with patch.object(live.model,"get",return_value={"total":1,"data":[row]}),patch.object(live.dt,"datetime",wraps=live.dt.datetime) as clock:
            clock.now.return_value=live.dt.datetime(2026,10,23,18,30,tzinfo=live.UTC)
            result=live.build()
        self.assertEqual(result["games"][0]["status"],"scheduled")
        self.assertIsNone(result["games"][0]["home"]["score"])
    def test_final_requires_scores(self):
        row=game(1,status="Final",score=None)
        with patch.object(live.model,"get",return_value={"total":1,"data":[row]}),patch.object(live.dt,"datetime",wraps=live.dt.datetime) as clock:
            clock.now.return_value=live.dt.datetime(2026,10,23,18,30,tzinfo=live.UTC)
            with self.assertRaisesRegex(ValueError,"Final missing score"):live.build()

if __name__=="__main__":unittest.main()

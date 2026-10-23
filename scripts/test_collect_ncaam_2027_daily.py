#!/usr/bin/env python3
"""Offline behavior tests for NCAA candidate scoreboard ingestion."""
import importlib.util,unittest
from datetime import date
from pathlib import Path
spec=importlib.util.spec_from_file_location("feed",Path(__file__).with_name("collect_ncaam_2027_daily.py"))
feed=importlib.util.module_from_spec(spec);spec.loader.exec_module(feed)
class FeedTests(unittest.TestCase):
    def test_valid_scoreboard(self):
        x=feed.collect(date(2026,11,2),1,lambda url:{"games":[{"game":{"gameID":"123","gameState":"pre"}}]})
        self.assertEqual(len(x["games"]),1)
        self.assertTrue(x["coverage_complete"])
    def test_failure_does_not_count_as_empty(self):
        def fail(url):raise ValueError("Source unreachable")
        x=feed.collect(date(2026,11,2),2,fail)
        self.assertFalse(x["coverage_complete"])
        self.assertEqual(len(x["failed_days"]),2)
        self.assertEqual(x["checked_days"],[])
    def test_invalid_duplicate(self):
        def bad(url):return {"games":[{"game":{"gameID":"1","score":"3"}},{"game":{"gameID":"1","score":"4"}}]}
        x=feed.collect(date(2026,11,2),1,bad)
        self.assertFalse(x["coverage_complete"])
if __name__=="__main__":unittest.main()

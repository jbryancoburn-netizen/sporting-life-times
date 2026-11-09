"""Offline checks for the 32-team independent local-press collector."""
import datetime as dt
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("local_press", ROOT / "scripts/refresh_nfl_local_press.py")
press = importlib.util.module_from_spec(spec)
spec.loader.exec_module(press)

class LocalPressTests(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads(press.REGISTRY.read_text())
        self.bears = next(t for t in self.registry["teams"] if t["id"] == "3")

    def test_full_league_sources(self):
        self.assertEqual(len(self.registry["teams"]), 32)
        self.assertEqual(len({t["id"] for t in self.registry["teams"]}), 32)
        self.assertTrue(all(len(t["local_sources"]) >= 2 for t in self.registry["teams"]))
        self.assertIn("chicagotribune.com", [s["domain"] for s in self.bears["local_sources"]])

    def test_direct_domain_required(self):
        paper = {"name": "Chicago Tribune", "domain": "chicagotribune.com"}
        self.assertTrue(press.valid_host("https://www.chicagotribune.com/2026/11/09/bears/", paper))
        self.assertFalse(press.valid_host("https://chicagotribune.com.evil.example/bears", paper))
        self.assertFalse(press.valid_host("https://news.google.com/rss/articles/abc", paper))
        self.assertFalse(press.valid_host("http://chicagotribune.com/bears", paper))
        self.assertTrue(press.valid_host("https://www.nytimes.com/athletic/football/", {"domain": "nytimes.com/athletic"}))
        self.assertFalse(press.valid_host("https://www.nytimes.com/2026/football/", {"domain": "nytimes.com/athletic"}))

    def test_headline_and_category(self):
        self.assertTrue(press.headline_match("Chicago Bears overcome five turnovers", self.bears))
        self.assertFalse(press.headline_match("Chicago Cubs overcome five turnovers", self.bears))
        bucs = next(t for t in self.registry["teams"] if t["id"] == "27")
        self.assertTrue(press.headline_match("Bucs suffer defeat after late field goal", bucs))
        self.assertEqual(press.category("Bears postgame reaction and takeaways"), "Post-Game")
        self.assertEqual(press.category("Bears injury report after win"), "Injuries")

    def test_parse_feed_and_false_link_rejection(self):
        now = dt.datetime(2026, 11, 9, 13, tzinfo=dt.timezone.utc)
        rss = b'<rss><channel><item><title>Bears win a wild game - Chicago Tribune</title><source>Chicago Tribune</source><link>https://news.google.com/rss/articles/abcd</link><pubDate>Mon, 09 Nov 2026 11:00:00 GMT</pubDate></item><item><title>Chicago Cubs clinch win</title><link>https://news.google.com/rss/articles/efgh</link><pubDate>Mon, 09 Nov 2026 11:00:00 GMT</pubDate></item></channel></rss>'
        result = press.parse_feed(rss, self.bears, now, 10)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["category"], "Post-Game")
        broader = b'<rss><channel><item><title>Bears win after late kick</title><source url="https://www.chicagotribune.com">Chicago Tribune</source><link>https://news.google.com/rss/articles/abcd</link><pubDate>Mon, 09 Nov 2026 11:00:00 GMT</pubDate></item><item><title>Bears win a game</title><source url="https://www.espn.com">ESPN</source><link>https://news.google.com/rss/articles/efgh</link><pubDate>Mon, 09 Nov 2026 11:00:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(len(press.parse_feed(broader, self.bears, now, 10,
                         allowed_sources=self.bears["local_sources"])), 1)
        self.assertNotIn("site:", press.search_url(self.bears, self.bears["local_sources"], "Bears", unrestricted=True))

    def test_freshness_and_dedupe(self):
        now = dt.datetime(2026, 11, 9, 13, tzinfo=dt.timezone.utc)
        rss = b'<rss><channel><item><title>Bears win</title><link>https://news.google.com/rss/articles/abcd</link><pubDate>Mon, 12 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(press.parse_feed(rss, self.bears, now, 10), [])
        entries = [{"url":"https://www.chicagotribune.com/bears?utm_source=rss","published_at":"2026-11-08T00:00:00+00:00"},
                   {"url":"https://www.chicagotribune.com/bears","published_at":"2026-11-09T00:00:00+00:00"}]
        self.assertEqual(len(press.unique(entries, 5)), 1)
        self.assertEqual(press.unique(entries, 5)[0]["published_at"], "2026-11-09T00:00:00+00:00")
        across_teams = [dict(entries[0], team_ids=["3"]), dict(entries[1], team_ids=["27"])]
        self.assertEqual(len(press.unique(across_teams, 5)), 2)

if __name__ == "__main__":
    unittest.main()

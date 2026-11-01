"""Offline regression checks: no network or developer access needed."""
import datetime as dt
import unittest
from scripts import politics_news_refresh as news

class PoliticsNewsTests(unittest.TestCase):
    def test_rejects_untrusted_article_link(self):
        self.assertIsNone(news.allowed_article_link("https://phishing.invalid/a", ("npr.org",)))
        self.assertIsNone(news.allowed_article_link("http://www.npr.org/a", ("npr.org",)))
        self.assertIsNone(news.allowed_article_link("https://www.npr.org.evil.test/a", ("npr.org",)))
        self.assertIsNone(news.allowed_article_link("https://user@www.npr.org/a", ("npr.org",)))
        self.assertEqual(news.allowed_article_link("https://www.npr.org/a#ref", ("npr.org",)), "https://www.npr.org/a")
    def test_rss_parsing_and_date_filtering(self):
        now = dt.datetime(2026, 11, 1, 15, tzinfo=dt.timezone.utc)
        body = ("""<rss><channel><item><title>Senate election forecast</title><link>https://www.pbs.org/newshour/politics/test</link><pubDate>Sun, 01 Nov 2026 13:00:00 GMT</pubDate></item><item><title>Ancient story</title><link>https://www.pbs.org/newshour/politics/old</link><pubDate>Mon, 01 Sep 2025 10:00:00 GMT</pubDate></item></channel></rss>""").encode()
        result = news.parse_feed(body, "PBS News", ("pbs.org",), now)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["source"], "PBS News")
    def test_rejects_non_story_calendar_title(self):
        now = dt.datetime(2026, 11, 1, 15, tzinfo=dt.timezone.utc)
        body = b'<rss><channel><item><title>November 2026</title><link>https://www.pbs.org/newshour/politics/calendar</link><pubDate>Sun, 01 Nov 2026 13:00:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(news.parse_feed(body, "PBS News", ("pbs.org",), now), [])

    def test_atom(self):
        now = dt.datetime(2026, 11, 1, 15, tzinfo=dt.timezone.utc)
        body = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Congress faces a vote</title><link rel="alternate" href="https://www.axios.com/a"/><published>2026-11-01T13:00:00Z</published></entry></feed>'
        result = news.parse_feed(body, "Axios", ("axios.com",), now)
        self.assertEqual(len(result), 1)
    def test_no_fabricated_data_on_failures(self):
        now = dt.datetime(2026, 11, 1, 15, tzinfo=dt.timezone.utc)
        def fail(*args):
            raise OSError("offline")
        report = news.build(fetcher=fail, now=now)
        self.assertEqual(report["articles"], [])
        self.assertEqual(report["status"], "insufficient_sources")

if __name__ == "__main__":
    unittest.main()

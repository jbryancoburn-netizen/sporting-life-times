#!/usr/bin/env python3
"""Regression tests for the two Hardwood Chronicle news editions."""
import unittest
from datetime import datetime, timedelta, timezone
from xml.sax.saxutils import escape

from refresh_cbb_national_news import (
    classify, choose, duplicate, link_type, parse_feed, score
)
from verify_cbb_news import verify


class HardwoodChronicleNewsTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)

    def article(self, title, gender, *, source="CBS Sports", url="https://publisher.example/story",
                hours=2, evidence="explicit_title", origin="publisher RSS"):
        return {
            "title": title, "gender": gender, "source": source, "url": url,
            "published_at": (self.now - timedelta(hours=hours)).isoformat(),
            "gender_evidence": evidence, "origin": origin, "link_type": link_type(url)
        }

    def xml(self, title, url, source="CBS Sports"):
        from email.utils import format_datetime
        return (
            "<rss><channel><item><title>" + escape(title) + "</title>"
            "<link>" + escape(url) + "</link><source>" + escape(source) + "</source>"
            "<pubDate>" + format_datetime(self.now) + "</pubDate></item></channel></rss>"
        ).encode()

    def test_football_never_becomes_mens_basketball(self):
        title = "Colorado ends No. 14 Houston's CFP hopes with Friday night upset"
        self.assertIsNone(classify(title))
        self.assertIsNone(classify(title, trusted_feed_gender="men"))
        self.assertEqual(parse_feed(self.xml(title, "https://news.google.com/rss/articles/1"),
                                    source_name="Google News", discovered=True, now=self.now), [])

    def test_kentucky_mens_story_not_mislabeled_women(self):
        self.assertIsNone(classify("Kentucky hits last-second three to avoid upset, Mark Pope reacts"))
        self.assertEqual(choose([self.article(
            "Kentucky hits last-second three to avoid upset, Mark Pope reacts", "women",
            evidence="explicit_title", origin="national RSS"
        )], gender="women", now=self.now), [])

    def test_explicit_womens_and_mens_basketball_are_separate(self):
        self.assertEqual(classify("Tennessee women's basketball holds off Tennessee State"), "women")
        self.assertEqual(classify("UConn men's basketball downs Ohio State"), "men")
        self.assertIsNone(classify("Stanford women basketball and St. Mary's men basketball both win"))

    def test_ambiguous_search_query_gender_does_not_authorize_story(self):
        rss = self.xml("Kentucky survives Northern Arizona", "https://news.google.com/rss/articles/xyz")
        self.assertEqual(parse_feed(rss, source_name="Google News",
                                    discovered=True, now=self.now), [])
        direct = parse_feed(rss.replace(b"news.google.com", b"publisher.example"),
                            source_name="ESPN Women's College Basketball",
                            trusted_gender="women", now=self.now)
        self.assertEqual(direct[0]["gender"], "women")
        self.assertEqual(direct[0]["gender_evidence"], "verified_basketball_feed")

    def test_direct_publisher_url_and_google_news_provenance(self):
        google = parse_feed(self.xml("UConn men's basketball tops Ohio State",
                    "https://news.google.com/rss/articles/abc"),
                    source_name="Google News", discovered=True, now=self.now)
        publisher = parse_feed(self.xml("UConn men's basketball tops Ohio State",
                    "https://example.org/story"), source_name="CBS Sports", now=self.now)
        self.assertEqual(google[0]["link_type"], "aggregator")
        self.assertEqual(publisher[0]["link_type"], "publisher")
        selected = choose(google + publisher, gender="men", now=self.now)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["link_type"], "publisher")

    def test_incorrect_gender_labels_rejected_even_in_old_feed(self):
        wrong = self.article("Texas women's basketball wins again", "men")
        self.assertEqual(choose([wrong], gender="men", now=self.now), [])
        wrong2 = self.article("Maryland men's basketball falls to Virginia", "women")
        self.assertEqual(choose([wrong2], gender="women", now=self.now), [])

    def test_routine_newer_school_story_does_not_outrank_upset(self):
        routine = self.article("Men's basketball continues home stand", "men", hours=1)
        upset = self.article("Men's basketball upsets No. 4 ranked team", "men", hours=6)
        self.assertGreater(score(upset, now=self.now), score(routine, now=self.now))

    def test_old_articles_removed_and_near_duplicates_deduped(self):
        first = self.article("UConn men's basketball defeats Ohio State 84 to 68", "men",
                             url="https://example.org/one")
        second = self.article("UConn men's basketball defeats Ohio State 84 to 68", "men",
                              url="https://other.example/two")
        expired = self.article("Duke men's basketball wins again", "men", hours=90)
        self.assertTrue(duplicate(first, second))
        self.assertEqual(len(choose([first, second, expired], gender="men", now=self.now)), 1)

    def test_verify_rejects_edition_contamination(self):
        stories = [
            self.article("UConn men's basketball beats Ohio State", "men", url="https://one.example/a"),
            self.article("Duke men's basketball wins big", "men", url="https://one.example/b"),
            self.article("Virginia men's basketball upsets rival", "men", url="https://one.example/c"),
            self.article("Tennessee women's basketball wins", "women", url="https://two.example/a"),
            self.article("Texas women's basketball tops opponent", "women", url="https://two.example/b"),
            self.article("UConn women's basketball defeats challenger", "women", url="https://two.example/c")
        ]
        data = {"updated_at": self.now.isoformat(), "articles": stories}
        self.assertIn("3 men's and 3 women's", verify(data, 30))
        data["articles"][3]["title"] = "Tennessee football ends season"
        with self.assertRaisesRegex(ValueError, "Misclassified"):
            verify(data, 30)


if __name__ == "__main__":
    unittest.main()

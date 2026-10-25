import datetime as dt
import email.utils
import unittest
from scripts.refresh_news import parse_rss, clean, parse_date

class NewsWireTests(unittest.TestCase):
    def test_team_story_classified_as_premier_league(self):
        when=email.utils.format_datetime(dt.datetime.now(dt.timezone.utc)-dt.timedelta(minutes=20))
        xml=('<rss><channel><item><title>Tottenham win at Chelsea</title>'
            '<link>https://example.org/story</link><description>Premier League report</description>'
            '<pubDate>'+when+'</pubDate></item></channel></rss>').encode()
        articles=parse_rss(xml,"Fixture test source","Multi-sport")
        self.assertEqual(len(articles),1)
        self.assertEqual(articles[0]["category"],"Premier League")
    def test_undated_items_rejected(self):
        xml=b'<rss><channel><item><title>Something</title><link>https://example.org/1</link></item></channel></rss>'
        self.assertEqual(parse_rss(xml,"Test","Football"),[])
    def test_markup_cleaned(self):
        self.assertEqual(clean("<p>Two &amp; three</p>"),"Two & three")
if __name__=="__main__":unittest.main()

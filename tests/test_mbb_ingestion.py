import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from mbb_player_boxscores import parse_boxscore,aggregate
from refresh_mbb_newspaper import parse_rss,parse_scores,parse_ncaa_crosscheck,fetch_ncaa_scoreboard
class Ingestion(unittest.TestCase):
 def test_boxscore_and_replay(self):
  data={'boxscore':{'players':[{'team':{'id':'1'},'statistics':[{'labels':['PTS','REB','AST','FG','FT','STL','BLK'],'athletes':[{'athlete':{'id':'8','displayName':'A Player'},'stats':['20','5','3','7-14','4-5','2','1']},{'didNotPlay':True}]}]}]}}
  rows=parse_boxscore(data,{'1':'ncaa:1'});games={'g1':rows};games['g1']=rows
  out=aggregate(games);self.assertEqual(out[0]['games'],1);self.assertEqual(out[0]['pts'],20);self.assertEqual(out[0]['fg'],50)
 def test_bad_rss_date_not_made_fresh(self):
  rss=b'<rss><channel><item><title>News</title><link>https://example.org/story</link><pubDate>bad</pubDate></item></channel></rss>'
  self.assertEqual(parse_rss(rss,'Source'),[])
 def test_empty_scoreboard_is_valid(self):self.assertEqual(parse_scores({'events':[]}),[])
 def test_ncaa_official_scores_have_independent_provenance(self):
  cross={'teams':[{'id':'ncaa:1','espn_id':'1','name':'Indiana','espn_name':'Indiana Hoosiers'},
                  {'id':'ncaa:2','espn_id':'2','name':'Purdue','espn_name':'Purdue Boilermakers'}]}
  official={'games':[{'game':{'gameID':'777','gameState':'final',
      'away':{'names':{'short':'Purdue'},'score':'71'},
      'home':{'names':{'short':'Indiana'},'score':'80'}}}]}
  provider=[{'id':'999','date':'2026-11-03T23:00:00Z',
      'competitions':[{'competitors':[
          {'homeAway':'away','team':{'id':'2'}},{'homeAway':'home','team':{'id':'1'}}]}]}]
  rows,missed=parse_ncaa_crosscheck(official,provider,cross,'2026-11-03')
  self.assertEqual(missed,0)
  self.assertEqual(rows[0]['id'],'ncaa:777')
  self.assertEqual(rows[0]['espn_id'],'999')
  self.assertEqual(rows[0]['phase'],'final')
  self.assertEqual((rows[0]['home_score'],rows[0]['away_score']),(80,71))
 def test_ambiguous_official_game_is_not_assigned_a_guessed_school(self):
  cross={'teams':[{'id':'ncaa:1','espn_id':'1','name':'Indiana'},
                  {'id':'ncaa:2','espn_id':'2','name':'Indiana'},
                  {'id':'ncaa:3','espn_id':'3','name':'Purdue'}]}
  official={'games':[{'game':{'gameID':'777','gameState':'final',
     'away':{'names':{'short':'Purdue'},'score':'71'},
     'home':{'names':{'short':'Indiana'},'score':'80'}}}]}
  rows,missed=parse_ncaa_crosscheck(official,[],cross,'2026-11-03')
  self.assertEqual(rows,[])
  self.assertEqual(missed,1)
 def test_womens_official_news_feed_is_tagged_wbb(self):
  rss=b'<rss><channel><item><title>Women basketball</title><link>https://www.ncaa.com/story</link><pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>'
  parsed=parse_rss(rss,'NCAA Women','WBB')
  self.assertEqual(len(parsed),1)
  self.assertEqual(parsed[0]['category'],'WBB')
  self.assertEqual(parsed[0]['source'],'NCAA Women')
 def test_ncaa_relay_is_not_independent_confirmation(self):
  urls=[]
  def fetched(url):
   urls.append(url)
   return b'{"games":[{"game":{"gameID":"123"}}]}'
  data,info=fetch_ncaa_scoreboard('basketball-men','2026-11-01',fetcher=fetched)
  self.assertEqual(len(data['games']),1)
  self.assertEqual(len(urls),1)
  self.assertTrue(urls[0].startswith('https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/2026/11/01'))
  self.assertEqual(info['provider'],'NCAA.com via third-party relay')
  self.assertFalse(info['independent_second_publisher'])
 def test_ncaa_direct_fallback_is_clearly_labeled(self):
  urls=[]
  def fetched(url):
   urls.append(url)
   if 'henrygd.me' in url:raise OSError('relay down')
   return b'{"games":[]}'
  data,info=fetch_ncaa_scoreboard('basketball-women','2026-11-02',fetcher=fetched)
  self.assertEqual(data['games'],[])
  self.assertEqual(len(urls),2)
  self.assertEqual(info['provider'],'NCAA.com direct (legacy)')
  self.assertEqual(info['attempted'][0]['error'],'OSError')
 def test_ncaa_unavailable_is_never_faked(self):
  def fetched(url):return b'{"error":"outage"}'
  with self.assertRaises(ValueError):
   fetch_ncaa_scoreboard('basketball-men','2026-11-01',fetcher=fetched)
if __name__=='__main__':unittest.main()

import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from mbb_player_boxscores import parse_boxscore,aggregate
from refresh_mbb_newspaper import parse_rss,parse_scores
class Ingestion(unittest.TestCase):
 def test_boxscore_and_replay(self):
  data={'boxscore':{'players':[{'team':{'id':'1'},'statistics':[{'labels':['PTS','REB','AST','FG','FT','STL','BLK'],'athletes':[{'athlete':{'id':'8','displayName':'A Player'},'stats':['20','5','3','7-14','4-5','2','1']},{'didNotPlay':True}]}]}]}}
  rows=parse_boxscore(data,{'1':'ncaa:1'});games={'g1':rows};games['g1']=rows
  out=aggregate(games);self.assertEqual(out[0]['games'],1);self.assertEqual(out[0]['pts'],20);self.assertEqual(out[0]['fg'],50)
 def test_bad_rss_date_not_made_fresh(self):
  rss=b'<rss><channel><item><title>News</title><link>https://example.org/story</link><pubDate>bad</pubDate></item></channel></rss>'
  self.assertEqual(parse_rss(rss,'Source'),[])
 def test_empty_scoreboard_is_valid(self):self.assertEqual(parse_scores({'events':[]}),[])
if __name__=='__main__':unittest.main()

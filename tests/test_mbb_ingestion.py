import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from mbb_player_boxscores import parse_boxscore,aggregate
from refresh_mbb_newspaper import parse_rss,parse_scores,parse_ncaa_crosscheck,fetch_ncaa_scoreboard,conference_schedule_fixtures,women_school_fixtures,parse_ncaa_player_boxscore,parse_ncaa_team_boxscore
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
 def test_conference_fixture_index_uses_published_ids_and_announced_tv(self):
  import tempfile,json
  with tempfile.TemporaryDirectory() as tmp:
   data=Path(tmp)/'data';data.mkdir()
   files=['mbb-official-conference-game-evidence.json','mbb-additional-conference-game-evidence.json','mbb-october-conference-evidence.json','mbb-western-conference-game-evidence.json']
   example={'season':'2026-27','rows':[{'date':'2026-11-01','visitor_id':'87','host_id':'222','relation':'vs.','tv':'FOX','source_url':'https://www.bigeast.com/2026/schedule'}]}
   for i,file in enumerate(files):
    (data/file).write_text(json.dumps(example if i==0 else {'season':'2026-27','rows':[]}))
   rows=conference_schedule_fixtures(Path(tmp),'2026-11-01')
   self.assertEqual(len(rows['games']),1)
   self.assertEqual(rows['games'][0]['team_ids'],['87','222'])
   self.assertEqual(rows['games'][0]['network_announced'],'FOX')
   self.assertTrue(rows['games'][0]['neutral_announced'])
   self.assertEqual(rows['invalid_rows'],0)
 def test_conference_conflicting_networks_are_not_guessed(self):
  import tempfile,json
  with tempfile.TemporaryDirectory() as tmp:
   data=Path(tmp)/'data';data.mkdir()
   files=['mbb-official-conference-game-evidence.json','mbb-additional-conference-game-evidence.json','mbb-october-conference-evidence.json','mbb-western-conference-game-evidence.json']
   for i,file in enumerate(files):
    rows=([{'date':'2026-11-01','visitor_id':'2','host_id':'3','tv':('FOX' if i==0 else 'CBS'),'source_url':'https://conference.example/schedule'}] if i<2 else [])
    (data/file).write_text(json.dumps({'season':'2026-27','rows':rows}))
   item=conference_schedule_fixtures(Path(tmp),'2026-11-01')['games'][0]
   self.assertTrue(item['network_conflict'])
   self.assertIsNone(item['network_announced'])
 def test_womens_verified_school_batches_keep_fixture_evidence_without_scores(self):
  import tempfile,json
  with tempfile.TemporaryDirectory() as tmp:
   data=Path(tmp)/'data';data.mkdir()
   files=['ncaaw-2026-27-official-schedule-verifications.json',
          'ncaaw-2026-27-additional-official-evidence.json',
          'ncaaw-official-school-verification-batch-01.json',
          'ncaaw-official-school-verification-batch-02.json',
          'ncaaw-official-school-verification-batch-03.json']
   for i,name in enumerate(files):
    rows=[]
    if i in (2,3):
     rows=[{'game_id':'401906031','team_id':('103' if i==2 else '107'),
            'opponent_id':('107' if i==2 else '103'),'date':'2026-11-02',
            'verified_fields':['local_game_date','opponent_id','home_away_or_neutral'],
            'source_url':'https://university.example/sports/womens-basketball/schedule'}]
    (data/name).write_text(json.dumps({'season':'2026-27','gender':'women','rows':rows}))
   evidence=women_school_fixtures(Path(tmp),'2026-11-02')
   self.assertEqual(len(evidence),1)
   self.assertEqual(evidence[0]['team_ids'],['103','107'])
   self.assertEqual(evidence[0]['school_confirmations'],2)
   self.assertNotIn('away_score',evidence[0])
 def test_conflicting_womens_school_opponents_are_quarantined(self):
  import tempfile,json
  with tempfile.TemporaryDirectory() as tmp:
   data=Path(tmp)/'data';data.mkdir()
   files=['ncaaw-2026-27-official-schedule-verifications.json',
          'ncaaw-2026-27-additional-official-evidence.json',
          'ncaaw-official-school-verification-batch-01.json',
          'ncaaw-official-school-verification-batch-02.json',
          'ncaaw-official-school-verification-batch-03.json']
   for i,name in enumerate(files):
    rows=[]
    if i in (2,3):
     rows=[{'game_id':'401906031','team_id':'103','opponent_id':('107' if i==2 else '108'),
            'date':'2026-11-02','verified_fields':['local_game_date','opponent_id'],
            'source_url':'https://university.example/schedule'}]
    (data/name).write_text(json.dumps({'season':'2026-27','gender':'women','rows':rows}))
   self.assertEqual(women_school_fixtures(Path(tmp),'2026-11-02'),[])
 def test_ncaa_player_boxscore_requires_exact_final_points(self):
  game={'phase':'final','ncaa_id':'6651023','espn_id':'401920982','day':'2026-11-01',
        'away_score':74,'home_score':72}
  players=[{'id':21,'fullName':'First Player','points':'70','assists':'2',
            'fieldGoalsMade':'10','fieldGoalsAttempted':'12'},
           {'id':22,'fullName':'Second Player','points':'4',
            'fieldGoalsMade':'1','fieldGoalsAttempted':'3'}]
  sample={'teamBoxscore':[
    {'teamId':'100','playerStats':players},
    {'teamId':'200','playerStats':[{'id':23,'fullName':'Home Player','points':'72'}]}],
    'teams':[{'teamId':'100','isHome':False},{'teamId':'200','isHome':True}]}
  verified=parse_ncaa_player_boxscore(sample,game)
  self.assertEqual(verified['away']['score'],74)
  self.assertEqual(verified['home']['players'][0]['pts'],72)
  self.assertEqual(verified['gender'],'men')
  sample['teamBoxscore'][0]['playerStats'][1]['points']='3'
  self.assertIsNone(parse_ncaa_player_boxscore(sample,game))
 def test_ncaa_player_boxscore_cannot_guess_unmapped_teams_or_invent_zeroes(self):
  game={'phase':'final','ncaa_id':'6651023','away_score':12,'home_score':9}
  data={'teamBoxscore':[{'teamId':'100','playerStats':[{'fullName':'A','points':'12'}]},
                        {'teamId':'200','playerStats':[{'fullName':'B','points':'9'}]}]}
  self.assertIsNone(parse_ncaa_player_boxscore(data,game))
  confirmed=parse_ncaa_player_boxscore(data,game,{'away':'100','home':'200'})
  self.assertIsNotNone(confirmed)
  data['teamBoxscore'][1]['playerStats'][0]['points']=''
  self.assertIsNone(parse_ncaa_player_boxscore(data,game,{'away':'100','home':'200'}))
 def test_ncaa_boxscore_cannot_promote_live_stats_as_finals(self):
  game={'phase':'live','ncaa_id':'6651023','away_score':12,'home_score':9}
  self.assertIsNone(parse_ncaa_player_boxscore({'teamBoxscore':[]},game))
 def test_ncaa_team_boxscore_succeeds_without_player_arrays(self):
  contest={'phase':'final','ncaa_id':'6651023','espn_id':'401920982',
           'day':'2026-11-01','away_score':74,'home_score':72}
  def team(teamid,pts,fgm,tpm,ftm):
   return {'teamId':teamid,'playerStats':[],
           'teamStats':{'points':str(pts),'fieldGoalsMade':str(fgm),
              'fieldGoalsAttempted':'50','threePointsMade':str(tpm),
              'threePointsAttempted':'20','freeThrowsMade':str(ftm),
              'freeThrowsAttempted':'20','totalRebounds':'30','assists':'11'}}
  data={'teams':[{'teamId':'1717','isHome':True},{'teamId':'1281','isHome':False}],
        'teamBoxscore':[team('1717',72,24,8,16),team('1281',74,25,8,16)]}
  # Deliberate mis-sum: 2*25+8+16=74 away; 2*24+8+16=72 home.
  result=parse_ncaa_team_boxscore(data,contest)
  self.assertIsNotNone(result)
  self.assertEqual(result['home']['ncaa_team_id'],'1717')
  self.assertEqual(result['away']['pts'],74)
  data['teamBoxscore'][0]['teamStats']['points']='71'
  self.assertIsNone(parse_ncaa_team_boxscore(data,contest))
 def test_ncaa_team_boxscore_requires_explicit_home_and_valid_shots(self):
  contest={'phase':'final','ncaa_id':'1','away_score':2,'home_score':3}
  box={'teamBoxscore':[
    {'teamId':'1','teamStats':{'points':'2','fieldGoalsMade':'1',
      'fieldGoalsAttempted':'2','threePointsMade':'0','threePointsAttempted':'1',
      'freeThrowsMade':'0','freeThrowsAttempted':'0'}},
    {'teamId':'2','teamStats':{'points':'3','fieldGoalsMade':'1',
      'fieldGoalsAttempted':'2','threePointsMade':'1','threePointsAttempted':'1',
      'freeThrowsMade':'0','freeThrowsAttempted':'0'}}]}
  self.assertIsNone(parse_ncaa_team_boxscore(box,contest))
  box['teams']=[{'teamId':'1','isHome':False},{'teamId':'2','isHome':True}]
  self.assertIsNotNone(parse_ncaa_team_boxscore(box,contest))
  box['teamBoxscore'][0]['teamStats']['fieldGoalsAttempted']='0'
  self.assertIsNone(parse_ncaa_team_boxscore(box,contest))
if __name__=='__main__':unittest.main()

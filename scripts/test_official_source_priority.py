"""Offline tests for NBA official source adapter and official-first publication."""
import sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parent))
import collect_official_scores as official
import collect_multisource as multi

class OfficialSourceTests(unittest.TestCase):
 def test_nba_only_queries_current_day(self):
  from datetime import datetime,timezone,timedelta
  day=datetime.now(timezone.utc).date()-timedelta(days=3)
  with patch.object(official,'fetch',side_effect=AssertionError('historical endpoint misuse')):
   self.assertEqual(official.nba(day)['games'],[])
 def test_nba_preserves_source_fields(self):
  from datetime import datetime,timezone
  day=datetime.now(timezone.utc).date()
  payload={'scoreboard':{'games':[{'gameId':'0022600010','gameTimeUTC':'2026-10-22T23:30:00Z','gameStatus':3,'gameStatusText':'Final','homeTeam':{'teamId':1,'teamCity':'Home','teamName':'Club','score':101},'awayTeam':{'teamId':2,'teamCity':'Away','teamName':'Club','score':99}}]}}
  with patch.object(official,'fetch',return_value=payload):
   result=official.nba(day)
  self.assertEqual(result['provider'],'nba_live')
  self.assertEqual(result['games'][0]['state'],'post')
  self.assertEqual(result['games'][0]['teams'][0]['score'],99)
  self.assertEqual(result['games'][0]['date'],'2026-10-22T23:30:00Z')
 def test_invalid_team_is_not_fabricated(self):
  from datetime import datetime,timezone
  with patch.object(official,'fetch',return_value={'scoreboard':{'games':[{'gameId':'1','gameTimeUTC':'2026-10-22T23:00:00Z','homeTeam':{},'awayTeam':{}}]}}):
   self.assertEqual(official.nba(datetime.now(timezone.utc).date())['games'],[])
 def test_official_replaces_fallback(self):
  import tempfile,json
  from pathlib import Path
  fallback={'leagues':[{'league':'NBA','provider':'espn','games':[{'id':'espn-1','state':'post','date':'2026-10-22T23:00:00Z','teams':[{'name':'Home Club','score':100},{'name':'Away Club','score':99}]}]}]}
  primary={'leagues':[{'league':'NBA','provider':'nba_live','source_url':'https://www.nba.com/games','games':[{'id':'nba-1','state':'post','date':'2026-10-22T23:00:00Z','provider':'nba_live','teams':[{'name':'Home Club','score':101},{'name':'Away Club','score':99}]}]}]}
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)
   (root/'scoreboards.json').write_text(json.dumps(fallback))
   (root/'official_scoreboards.json').write_text(json.dumps(primary))
   with patch.object(multi,'ROOT',root):
    multi.main()
   published=json.loads((root/'multi_scoreboards.json').read_text())
   self.assertEqual(published['leagues'][0]['provider'],'nba_live')
   self.assertEqual(published['leagues'][0]['games'][0]['id'],'nba-1')
   self.assertTrue(published['conflicts'],'disputed scores must remain auditable')

if __name__=='__main__':unittest.main()

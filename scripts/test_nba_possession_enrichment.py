import copy
import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('enrich',Path(__file__).with_name('enrich-nba-game-details.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PossessionInputs(unittest.TestCase):
 def setUp(self):
  self.game={'id':'espn-nba-123','state':'post','teams':[{'code':c,'home_away':side,'score':100} for side,c in [('home','BOS'),('away','CHI')]]}
  stats={'fieldGoalsMade-fieldGoalsAttempted':'35-80','threePointFieldGoalsMade-threePointFieldGoalsAttempted':'10-30','freeThrowsMade-freeThrowsAttempted':'20-25','offensiveRebounds':'10','totalTurnovers':'12'}
  self.summary={'header':{'season':{'year':2027,'type':2},'competitions':[{'status':{'type':{'completed':True}},'competitors':[{'homeAway':side,'linescores':[{'value':25}]*4} for side in ['home','away']]}]},'boxscore':{'teams':[{'team':{'abbreviation':c},'statistics':[{'name':k,'displayValue':v} for k,v in stats.items()]} for c in ['BOS','CHI']]}}
 def test_valid_attributed_counts(self):
  r=m.possession_inputs(self.summary,self.game);self.assertEqual(r['home']['fga'],80);self.assertEqual(r['away']['tov'],12);self.assertIn('ESPN',r['source'])
 def test_score_mismatch_rejected(self):
  self.game['teams'][0]['score']=101;self.assertIsNone(m.possession_inputs(self.summary,self.game))
 def test_missing_turnovers_rejected(self):
  self.summary['boxscore']['teams'][0]['statistics'].pop();self.assertIsNone(m.possession_inputs(self.summary,self.game))
 def test_preseason_and_unfinished_rejected(self):
  self.summary['header']['season']['type']=1;self.assertIsNone(m.possession_inputs(self.summary,self.game))
  self.summary['header']['season']['type']=2;self.game['state']='in';self.assertIsNone(m.possession_inputs(self.summary,self.game))
 def test_duplicate_team_rejected(self):
  self.summary['boxscore']['teams'][1]=copy.deepcopy(self.summary['boxscore']['teams'][0]);self.assertIsNone(m.possession_inputs(self.summary,self.game))
if __name__=='__main__':unittest.main()

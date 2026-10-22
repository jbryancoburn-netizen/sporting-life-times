import datetime,json,tempfile,unittest
from pathlib import Path
from publish_usrs import validate,publish

class USRSPublishingTests(unittest.TestCase):
 def sample(self):
  date=(datetime.datetime.now(datetime.timezone.utc).date()+datetime.timedelta(days=1)).isoformat()
  return dict(schema_version=1,status='provisional_research',model='usrs-6.1-provisional',
      poisson_weight=.5,matches=[dict(date=date,home='Team A',away='Team B',
          home_win=.5,draw=.3,away_win=.2,model_version='usrs-6.1-provisional')])
 def test_accept_future_fixture(self):
  self.assertEqual(len(validate(self.sample())['matches']),1)
 def test_reject_past_fixture(self):
  d=self.sample();d['matches'][0]['date']='2020-01-01'
  with self.assertRaises(ValueError):validate(d)
 def test_reject_bad_probabilities(self):
  d=self.sample();d['matches'][0]['draw']=.4
  with self.assertRaises(ValueError):validate(d)
 def test_reject_duplicates(self):
  d=self.sample();d['matches'].append(d['matches'][0].copy())
  with self.assertRaises(ValueError):validate(d)
 def test_publication(self):
  with tempfile.TemporaryDirectory() as tmp:
   src=Path(tmp)/'in.json';dst=Path(tmp)/'data'/'usrs-forecasts.json'
   src.write_text(json.dumps(self.sample()))
   self.assertEqual(publish(src,dst),1)
   self.assertTrue(dst.exists())

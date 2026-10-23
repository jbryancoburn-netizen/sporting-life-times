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
 def test_reject_unapproved_release_status(self):
  d=self.sample();d['status']='production_approved'
  with self.assertRaises(ValueError):validate(d)
 def test_reject_non_usrs_model(self):
  d=self.sample();d['model']='third-party-elo'
  with self.assertRaises(ValueError):validate(d)
 def test_reject_mixed_model_versions(self):
  d=self.sample();d['matches'][0]['model_version']='usrs-other'
  with self.assertRaises(ValueError):validate(d)
 def test_reject_nan_and_infinite(self):
  for value in (float('nan'),float('inf')):
   d=self.sample();d['matches'][0]['home_win']=value
   with self.assertRaises(ValueError):validate(d)
 def test_reject_empty_export(self):
  d=self.sample();d['matches']=[]
  with self.assertRaises(ValueError):validate(d)
 def test_reject_far_future_fixture(self):
  d=self.sample();d['matches'][0]['date']='2099-01-01'
  with self.assertRaises(ValueError):validate(d)
 def test_reject_self_fixture(self):
  d=self.sample();d['matches'][0]['away']='Team A'
  with self.assertRaises(ValueError):validate(d)
 def test_reject_non_normalized_probabilities(self):
  d=self.sample();d['matches'][0]['draw']=.35
  with self.assertRaises(ValueError):validate(d)

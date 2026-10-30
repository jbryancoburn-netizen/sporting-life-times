import unittest
from mbb_patriot_summit_recovery import eligible,selections
class PolicyTests(unittest.TestCase):
 def test_only_named_mens_selections(self):
  self.assertEqual(len(selections()),16)
  self.assertTrue(all(x['timezone']=='ET' for x in selections()))
 def test_excludes_wildcards_away_neutral_and_exhibitions(self):
  row=dict(date='2027-01-05',site='home',site_explicit=True,exhibition=False)
  self.assertTrue(eligible(row,set()))
  for patch in [dict(date='2027-02-21'),dict(date='2027-02-27'),dict(date='2027-03-07'),dict(site='neutral'),dict(site='away'),dict(exhibition=True),dict(site_explicit=False)]:
   self.assertFalse(eligible({**row,**patch},set()))
  self.assertFalse(eligible(row,{'2027-01-05'}))

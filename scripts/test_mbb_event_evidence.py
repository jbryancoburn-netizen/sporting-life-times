import copy, unittest
import mbb_event_evidence_recovery as event
import mbb_network_grid_recovery as grid
class EvidenceTests(unittest.TestCase):
 def setUp(self):
  self.e={'id':'game','date':'2026-12-21','site_verified':False,'site_conflict':{},'competitions':[{'competitors':[{'team':{'id':'1'},'homeAway':'home'},{'team':{'id':'2'},'homeAway':'away'}]}]}
  self.row={'date':'2026-12-21','team_ids':['1','2'],'arenaName':'Explicit Arena','source_url':'https://official.example/event','site_source_url':'https://official.example/schedule','site_override':'neutral'}
 def test_exact_unique_and_idempotent(self):
  docs={'1':{'events':[copy.deepcopy(self.e)]}}
  self.assertEqual(len(event.apply(docs,[self.row])),1)
  self.assertEqual(event.apply(docs,[self.row]),[])
  e=docs['1']['events'][0];self.assertNotIn('site_conflict',e)
  self.assertTrue(e['site_verified']);self.assertTrue(e['neutralSite'])
 def test_wrong_date_and_ambiguous_skipped(self):
  docs={'1':{'events':[copy.deepcopy(self.e),copy.deepcopy(self.e)]}}
  self.assertEqual(event.apply(docs,[self.row]),[])
  docs['1']['events']=docs['1']['events'][:1]
  self.assertEqual(event.apply(docs,[dict(self.row,date='2026-12-22')]),[])
 def test_multiline_caption_and_wildcard(self):
  rows,excluded=grid.parse([{'page':1,'cells':['Nov 10','7 p.m.','Champions Classic\nDuke vs. Kansas','ESPN']},{'page':1,'cells':['','9 p.m.','TBD vs. Kentucky','ESPN']}])
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['visitor'],'Duke')
  self.assertEqual(len(excluded),1);self.assertEqual(rows[0]['date'],'2026-11-10')
if __name__=='__main__':unittest.main()

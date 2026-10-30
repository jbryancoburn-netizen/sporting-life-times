import unittest,copy
from mbb_deep_official_recovery import apply
class RecoveryTest(unittest.TestCase):
 def setUp(self):
  self.doc={'events':[{'id':'game','date':'2026-11-02T17:00:00Z','name':'Duke Blue Devils','competitions':[{'competitors':[{'team':{'id':'2'}},{'team':{'id':'150','displayName':'Duke Blue Devils'}}],'venue':{},'broadcasts':[]}]}]}
  self.row={'date':'2026-11-02','opponent':'Duke','arena':'Cameron Indoor Stadium','city':'Durham, NC','tv':'ESPN+','time':'7 p.m. ET','site':'away','site_explicit':True}
 def test_adds_explicit_fields_and_is_idempotent(self):
  changes,_=apply(self.doc,'2',[self.row],'https://school.edu/schedule')
  self.assertEqual(len(changes),5)
  self.assertEqual(apply(self.doc,'2',[self.row],'https://school.edu/schedule')[0],[])
 def test_duplicate_source_rows_are_rejected(self):
  self.assertEqual(apply(self.doc,'2',[self.row,self.row],'https://school.edu/schedule')[0],[])
 def test_duplicate_calendar_rows_are_rejected(self):
  self.doc['events']*=2
  self.assertEqual(apply(self.doc,'2',[self.row],'https://school.edu/schedule')[0],[])
 def test_not_a_time_or_network(self):
  self.row.update(time='Bonnies Online Network',tv='Listen Live',arena='Center',site_explicit=False)
  changes,_=apply(self.doc,'2',[self.row],'https://school.edu/schedule')
  self.assertEqual([c['field'] for c in changes],['official_school_city'])
 def test_existing_values_are_preserved(self):
  e=self.doc['events'][0];e['official_school_time']='8 PM';e['competitions'][0]['broadcasts']=[{'names':['ABC']}]
  apply(self.doc,'2',[self.row],'https://school.edu/schedule')
  self.assertEqual(e['official_school_time'],'8 PM');self.assertEqual(e['competitions'][0]['broadcasts'][0]['names'],['ABC'])
 def test_wrong_date_is_rejected(self):
  self.row['date']='2026-11-03'
  self.assertEqual(apply(self.doc,'2',[self.row],'https://school.edu/schedule')[0],[])
if __name__=='__main__':unittest.main()

class ClassicTimeTest(unittest.TestCase):
 def test_mobile_radio_label_does_not_replace_tipoff(self):
  from mbb_complete_official_fields import parse
  html='''<title>2026-27 Men's Basketball Schedule</title>
  <li class="sidearm-schedule-game sidearm-schedule-home-game" data-game-id="1">
  <div class="sidearm-schedule-game-opponent-name">Duke</div>
  <div class="sidearm-schedule-game-opponent-date"><span>Nov 2 (Mon)</span><span>7:00 p.m.</span><span class="hide-on-x-large">Bonnies Online Network</span></div></li>'''
  self.assertEqual(parse(html)[0]['time'],'7:00 p.m.')
 def test_network_without_clock_remains_unknown(self):
  from mbb_complete_official_fields import parse
  html='''<title>2026-27 Men's Basketball Schedule</title>
  <li class="sidearm-schedule-game" data-game-id="1"><div class="sidearm-schedule-game-opponent-name">Duke</div><div class="sidearm-schedule-game-opponent-date"><span>Nov 2</span><span>ESPN+</span></div></li>'''
  self.assertEqual(parse(html)[0]['time'],'')

class AccessibleTimeTest(unittest.TestCase):
 def test_compact_layout_reads_game_local_accessible_clock(self):
  from mbb_complete_official_fields import parse
  html='''<title>2026-27 Men's Basketball Schedule</title><li class="sidearm-schedule-game" data-game-id="1"><div class="sidearm-schedule-game-opponent-name"><a aria-label="Duke on November 2 7:30 PM">Duke</a></div><div class="sidearm-schedule-game-opponent-date"><span>Nov 2</span></div></li>'''
  self.assertEqual(parse(html)[0]['time'],'7:30 PM')

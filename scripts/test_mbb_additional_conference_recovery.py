import unittest
import mbb_additional_conference_recovery as m
class AdditionalConferenceTests(unittest.TestCase):
 def test_mvc_wildcard_is_not_a_selected_network(self):
  text='''2026-27 MVC MEN Central Time
Fri. Jan. 8   %Illinois State @ Belmont (MBB -- ESPNU)   Nashville, Tennessee  8 p.m.
Sat. Jan. 9   Northern Iowa @ Indiana State (MBB -- ESPN+)   Terre Haute, Indiana  12 p.m.
'''
  rows=m.mvc_rows(text)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['timezone'],'CT')
  self.assertEqual(rows[0]['date'],'2027-01-09')
 def test_a10_rule_only_covers_blank_regular_fixtures(self):
  text='''2026-27 All times Eastern
Saturday, January 9
Richmond at Davidson 2:30 pm USA Network
La Salle at Rhode Island
Wednesday, March 10
Atlantic 10 Tournament First Round
'''
  rows=m.a10_stream_rows(text)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['visitor'],'La Salle')
  self.assertEqual(rows[0]['tv'],'ESPN+')
  self.assertEqual(rows[0]['fixture_source_url'],m.previous.A10)
 def test_wcc_and_caa_keep_timezone_evidence(self):
  text=m.WCC+'''
L34: Thurs. | Nov. 19 | VCU at Santa Clara | 7:30 PM | ESPN2
--------------------------------------------------------------------------------
'''+m.CAA+'''
L40: Thursday, Dec. 31 | Drexel at William & Mary | 2:00 p.m.
'''
  rows=m.announcement_rows(text)
  self.assertEqual(len(rows),2)
  self.assertEqual(rows[0]['timezone'],'PT')
  self.assertEqual(rows[1]['time'],'')
if __name__=='__main__':unittest.main()

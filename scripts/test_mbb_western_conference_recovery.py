import unittest
import mbb_western_conference_recovery as m

class WesternConferenceTests(unittest.TestCase):
 def test_pacific_times_and_unknown_time(self):
  text='''2026-27 Pac-12 All times listed PT
L40: Saturday, November 7
L41: Colorado vs. San Diego State 12:30 p.m. USA
L42: New Mexico State at Gonzaga 2:00. p.m. The CW
L43: Sunday, January 24
L44: Gonzaga at Oregon State TBD USA
'''
  rows=m.pac_rows(text)
  self.assertEqual(len(rows),3)
  self.assertEqual(rows[0]['timezone'],'PT')
  self.assertEqual(rows[0]['relation'],'vs.')
  self.assertEqual(rows[1]['time'],'2:00 p.m.')
  self.assertEqual(rows[2]['date'],'2027-01-24')
  self.assertEqual(rows[2]['time'],'TBD')
 def test_local_pdf_times_not_copied(self):
  text='''2026-27 Mountain West All times are local
Monday, November 2
Seattle at Hawai’i (MW+) TBA
Tuesday, November 17
UNLV vs. West Virginia/Auburn (Las Vegas) TBA
'''
  rows=m.mw_rows(text)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['time'],'')
  self.assertEqual(rows[0]['tv'],'MW+')
  self.assertEqual(rows[0]['host'],'Hawaii')
if __name__=='__main__':unittest.main()

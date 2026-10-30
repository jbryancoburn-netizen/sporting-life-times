import unittest
import mbb_american_a10_cusa_recovery as m
class CompositeTests(unittest.TestCase):
 def test_american_superscript_and_conditional(self):
  rows=m.american('''2026-27 All times Eastern
Monday, November 2
UAB vs McNeese 13
YouTube 5:30 p.m.
Tuesday, November 24
Temple vs Indiana State/SFA 2 ESPN TBA
Rice at UNT* ESPN+ 8 p.m.
''')
  self.assertEqual(len(rows),2)
  self.assertEqual(rows[0]['host'],'McNeese')
  self.assertEqual(rows[0]['relation'],'vs.')
  self.assertEqual(rows[1]['date'],'2026-11-24')
 def test_a10_leaves_unannounced_rows(self):
  rows=m.atlantic('''2026-27 All times Eastern
Saturday, January 9
VCU at George Washington 2:00 pm ESPNU
Richmond at Davidson
''')
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['date'],'2027-01-09')
 def test_conflicting_broadcast_rows_are_excluded(self):
  text='''AWAY TEAM TIME (ET)
L54: 12/31/2026 | WKU | Kennesaw State | ESPN2 | 6:00 PM
L131: 12/31/2026 | WKU | Kennesaw State | ESPN+ | 6:00 PM
L55: 1/2/2027 | Delaware | Liberty | ESPNU | 6:00 PM'''
  rows,conflicts=m.unambiguous(m.cusa(text))
  self.assertEqual(len(rows),1)
  self.assertEqual(len(conflicts),1)
  self.assertEqual(rows[0]['visitor'],'Delaware')
if __name__=='__main__':unittest.main()

import unittest
from collect_college_schedules import parse
TABLE='<table><tr><th>Date</th><th>Time</th><th>At</th><th>Opponent</th><th>Location</th><th>TV</th><th>Radio</th><th>Result</th></tr><tr><td>September 3, 2026 (Thursday)</td><td>7 p.m.</td><td>Home</td><td>Chicago</td><td>Angola</td><td></td><td></td><td>W, 48-34</td></tr><tr><td>October 24, 2026 (Saturday)</td><td>1 p.m.</td><td>Away</td><td>Adrian</td><td>Adrian</td><td></td><td></td><td></td></tr></table>'
class TestCollege(unittest.TestCase):
 def test_final(self):
  g=parse(TABLE,'Trine','https://example.com')[0]
  self.assertEqual((g['date'],g['state'],g['teams'][0]['score']),('2026-09-03','post',48))
 def test_upcoming(self):
  g=parse(TABLE,'Trine','https://example.com')[1]
  self.assertEqual((g['date_precision'],g['state'],g['teams'][0]['score']),('day','pre',None))
 def test_no_guess(self):
  self.assertEqual(parse('<html>no schedule</html>','Trine','https://example.com'),[])
 def test_invalid_winner(self):
  self.assertEqual(len(parse(TABLE.replace('W, 48-34','W, 12-34'),'Trine','https://example.com')),1)
if __name__=='__main__':unittest.main()

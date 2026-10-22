import unittest
from engine import merge
class EngineTests(unittest.TestCase):
 def test_official_preferred(self):
  old={"league":"MLB","games":[{"id":"espn:1","date":"2026-10-22","state":"pre","teams":[{"name":"Cubs"},{"name":"Rays"}]}]}
  new={"league":"MLB","games":[{"id":"mlb:2","date":"2026-10-22","state":"post","teams":[{"name":"Cubs","score":2},{"name":"Rays","score":3}]}]}
  self.assertEqual(merge([old],[new])[0]["games"][0]["id"],"mlb:2")
 def test_empty_keeps_backup(self):
  self.assertEqual(merge([{"league":"NHL","games":[{"id":"x"}]}],[{"league":"NHL","games":[]}])[0]["games"][0]["id"],"x")
 def test_conflicting_finals_flagged(self):
  def g(n):return {"date":"2026-10-22","state":"post","teams":[{"name":"A","score":n},{"name":"B","score":2}]}
  r=merge([{"league":"MLB","games":[g(1)]}],[{"league":"MLB","games":[g(3)]}])
  self.assertEqual(len(r[0]["conflicts"]),1)
  self.assertEqual(r[0]["games"][0]["teams"][0]["score"],1)
if __name__=="__main__":unittest.main()

import json,tempfile,unittest
from pathlib import Path
from check_eps_match_center import check
class EPLMatchCenterJoinTests(unittest.TestCase):
 def test_matching_ids_and_utc_kickoff(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"p.json";b=Path(d)/"b.json"
   p.write_text(json.dumps({"fixtures":[{"fixture_id":"101","kickoff_utc":"2026-10-23T19:00:00+00:00","home":{"id":"1"},"away":{"id":"2"}}]}))
   b.write_text(json.dumps({"leagues":[{"league":"Premier League","games":[{"id":"101","date":"2026-10-23T19:00Z","teams":[{"name":"A"},{"name":"B"}]}]}]}))
   self.assertEqual(check(p,b)["matching_fixture_ids"],1)
   b.write_text(json.dumps({"leagues":[{"league":"Premier League","games":[{"id":"101","date":"2026-10-23T20:00Z","teams":[{"name":"A"},{"name":"B"}]}]}]}))
   with self.assertRaisesRegex(ValueError,"mismatch"):check(p,b)
if __name__=="__main__":unittest.main()

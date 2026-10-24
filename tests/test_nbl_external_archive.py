import unittest
from scripts.crosscheck_nbl26_archive import visible, audit, compact

class NBLExternalArchiveTests(unittest.TestCase):
    def test_team_name_alias_and_whitespace_in_archived_score(self):
        raw='<html><body><li>Thursday, 18 September 2025: <a>Tasmania Jackjumpers 84 Melbourne United 88</a></li></body></html>'
        text=visible(raw)
        item={"id":"401787514","played_at":"2025-09-18T09:30Z",
              "home":"Tasmania JackJumpers","away":"Melbourne United","home_score":84,"away_score":88}
        result=audit({"status":"uncertified_source_candidates","games":[item]},text)
        self.assertEqual(result["matched_scorelines"],1)
        self.assertEqual(result["unmatched_count"],0)
        self.assertFalse(result["production_approved"])
    def test_does_not_falsely_certify_partial_archive(self):
        data={"status":"uncertified_source_candidates","games":[
            {"id":"401000001","played_at":"2025-10-01T08:00Z","home":"Sydney Kings",
             "away":"Perth Wildcats","home_score":95,"away_score":80}]}
        result=audit(data,compact("Sydney Kings 95 Perth Wildcats 80"))
        self.assertEqual(result["status"],"partial_or_unreconciled")
    def test_rejects_promoted_inputs(self):
        with self.assertRaises(ValueError):
            audit({"status":"certified","games":[]},compact(""))
if __name__=="__main__":unittest.main()

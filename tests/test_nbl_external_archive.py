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
    def test_documented_external_typo_must_be_present_to_reconcile(self):
        game={"id":"401787560","played_at":"2025-11-22T09:00Z",
            "home":"South East Melbourne Phoenix","away":"Adelaide 36ers",
            "home_score":81,"away_score":94}
        d={"status":"uncertified_source_candidates","games":[game]}
        result=audit(d,compact("South East Melbourne Phoenix 81 Adelaide 36ers 93"))
        self.assertEqual(result["documented_discrepancies"],1)
        self.assertEqual(result["unmatched_count"],0)
        self.assertFalse(result["production_approved"])
        bad=audit(d,compact("South East Melbourne Phoenix 81 Adelaide 36ers 92"))
        self.assertEqual(bad["unmatched_count"],1)
    def test_reviewed_reversed_matchup_is_explicit_not_hidden(self):
        game={"id":"401863732","played_at":"2026-03-14T09:00Z",
            "home":"Perth Wildcats","away":"Sydney Kings",
            "home_score":75,"away_score":89}
        result=audit({"status":"uncertified_source_candidates","games":[game]},
            compact("Sydney Kings 89 Perth Wildcats 75"))
        self.assertEqual(result["discrepancy_details"][0]["discrepancy"],"article_reverses_team_order")
    def test_does_not_falsely_certify_partial_archive(self):
        data={"status":"uncertified_source_candidates","games":[
            {"id":"401000001","played_at":"2025-10-01T08:00Z","home":"Sydney Kings",
             "away":"Perth Wildcats","home_score":95,"away_score":80}]}
        result=audit(data,compact("Sydney Kings 95 Perth Wildcats 80"))
        self.assertEqual(result["status"],"partial_or_unreconciled")
    def test_all_five_official_exceptions_match_game_dates_and_scorelines(self):
        from scripts.crosscheck_nbl26_archive import OFFICIAL_EXCEPTIONS,check_official_exception
        for gid,ref in OFFICIAL_EXCEPTIONS.items():
            score=ref["score"]
            game={"id":gid,"played_at":ref["date"]+"T09:00Z"}
            page="The "+ref["clubs"][0]+" faced "+ref["clubs"][1]+" in a "+score+" result."
            with self.subTest(game=gid):
                self.assertTrue(check_official_exception(game,page))
                self.assertFalse(check_official_exception({**game,"played_at":"2024-01-01T09:00Z"},page))
    def test_rejects_promoted_inputs(self):
        with self.assertRaises(ValueError):
            audit({"status":"certified","games":[]},compact(""))
if __name__=="__main__":unittest.main()

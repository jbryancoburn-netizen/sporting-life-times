import unittest
from datetime import date
from ncaam_archive_reconcile import reconcile,check

BASE={"rankings":[
    {"team_id":"ncaa:1","team":"Indiana"},
    {"team_id":"ncaa:2","team":"Purdue"}
]}
ESPN={"contest_id":"espn:123","game_date":"2026-11-03",
      "home":"Indiana","away":"Purdue",
      "home_score":"80","away_score":"70","status":"final"}
def archive(h="80",a="70"):
    return [{"contest_id":"ncaatest","game_date":"11/03/2026",
             "home":"Indiana","away":"Purdue","home_score":h,"away_score":a}]

class ArchiveSourceTests(unittest.TestCase):
    def test_same_result_gets_independent_confirmation(self):
        rows,audit=reconcile([ESPN],BASE,date(2026,11,6),archive())
        self.assertEqual(rows,[ESPN])
        self.assertEqual(audit["confirmed_final_count"],1)
        self.assertEqual(audit["score_conflict_count"],0)
    def test_disagreement_quarantines_final(self):
        rows,audit=reconcile([ESPN],BASE,date(2026,11,6),archive("81"))
        self.assertEqual(rows,[])
        self.assertEqual(audit["score_conflict_count"],1)
        self.assertEqual(audit["score_conflicts"][0]["ncaa_archive_score"],[81,70])
    def test_archival_outage_not_mislabeled_confirmation(self):
        rows,audit=check([ESPN],BASE,date(2026,11,6),
                         fetcher=lambda:(None,"HTTP 404"))
        self.assertEqual(rows,[ESPN])
        self.assertEqual(audit["status"],"UNAVAILABLE_NOT_INDEPENDENTLY_CONFIRMED")
        self.assertEqual(audit["confirmed_final_count"],0)
    def test_future_score_is_never_considered_a_final(self):
        rows,audit=reconcile([ESPN],BASE,date(2026,11,2),archive("99"))
        self.assertEqual(rows,[ESPN])
        self.assertEqual(audit["confirmed_final_count"],0)
    def test_nonfinal_scores_not_used(self):
        row=dict(ESPN,status="scheduled",home_score="")
        rows,audit=reconcile([row],BASE,date(2026,11,6),archive())
        self.assertEqual(rows,[row])
        self.assertEqual(audit["confirmed_final_count"],0)
if __name__=="__main__":unittest.main()

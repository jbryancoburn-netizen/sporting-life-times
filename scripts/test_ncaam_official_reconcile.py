import unittest
from datetime import date
from ncaam_official_reconcile import verify,reconcile

BASE={"rankings":[
    {"team_id":"ncaa:1","team":"Indiana"},
    {"team_id":"ncaa:2","team":"Purdue"}
]}
ESPN={"contest_id":"espn:123","game_date":"2026-11-03",
      "home":"Indiana","away":"Purdue",
      "home_score":"80","away_score":"70","status":"final"}
def ncaa(home="80",away="70"):
    return {"game":{"gameState":"final",
        "home":{"names":{"short":"Indiana"},"score":home},
        "away":{"names":{"short":"Purdue"},"score":away}}}

class IndependentScoreTests(unittest.TestCase):
    def test_matching_verified_final_is_kept(self):
        rows,audit=verify([ESPN],[ncaa()],BASE,"2026-11-03")
        self.assertEqual(rows,[ESPN])
        self.assertEqual(audit["crosschecked_espn_finals"],1)
        self.assertEqual(audit["score_conflict_count"],0)

    def test_mismatched_score_quarantines_game(self):
        rows,audit=verify([ESPN],[ncaa(home="82")],BASE,"2026-11-03")
        self.assertEqual(rows,[])
        self.assertEqual(audit["score_conflict_count"],1)
        self.assertEqual(audit["score_conflicts"][0]["ncaa_score"],[82,70])

    def test_missing_official_game_is_not_false_disagreement(self):
        rows,audit=verify([ESPN],[],BASE,"2026-11-03")
        self.assertEqual(rows,[ESPN])
        self.assertEqual(audit["espn_only_finals"],1)

    def test_official_outage_is_reported_not_disguised(self):
        def offline(_):return None,"HTTP 404"
        rows,audit=reconcile([ESPN],BASE,date(2026,11,4),fetcher=offline)
        self.assertEqual(rows,[ESPN])
        self.assertEqual(audit["official_days_checked"],0)
        self.assertTrue(audit["unavailable_days"])

    def test_official_conflict_is_removed_across_replay(self):
        def second(day):
            return ({"games":[ncaa(home="82")]},None) if day==date(2026,11,3) else ({"games":[]},None)
        rows,audit=reconcile([ESPN],BASE,date(2026,11,4),fetcher=second)
        self.assertEqual(rows,[])
        self.assertEqual(audit["conflict_count"],1)
if __name__=="__main__":unittest.main()

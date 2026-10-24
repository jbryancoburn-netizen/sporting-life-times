import unittest
from datetime import date
from scripts.stage_nbl_history import normalize, months

class NBLStagingTests(unittest.TestCase):
    def event(self,state="post",completed=True):
        return {"id":"401987654","date":"2026-10-20T08:00:00Z","status":{"type":{"state":state,"completed":completed}},
        "competitions":[{"competitors":[
            {"homeAway":"home","score":"92","team":{"displayName":"Sydney Kings"}},
            {"homeAway":"away","score":"85","team":{"displayName":"Perth Wildcats"}}]}],
        "links":[{"href":"https://www.espn.com/nbl/game/_/gameId/401987654"}]}
    def test_stages_completed_game_as_uncertified(self):
        g=normalize(self.event())
        self.assertEqual((g["home_score"],g["away_score"]),(92,85))
        self.assertFalse(g["verified"])
        self.assertEqual(g["state"],"candidate")
        self.assertTrue(g["source_url"].startswith("https://"))
    def test_does_not_stage_live_or_unconfirmed(self):
        self.assertIsNone(normalize(self.event("in",False)))
        self.assertIsNone(normalize(self.event("post",False)))
    def test_rejects_tied_finals(self):
        event=self.event()
        event["competitions"][0]["competitors"][1]["score"]="92"
        self.assertIsNone(normalize(event))
    def test_month_windows_cover_leap_boundary(self):
        windows=list(months(date(2026,2,25),date(2026,4,2)))
        self.assertEqual(windows,[(date(2026,2,25),date(2026,2,28)),(date(2026,3,1),date(2026,3,31)),(date(2026,4,1),date(2026,4,2))])
if __name__=="__main__":unittest.main()

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
    def test_transient_connection_error_retries_without_inventing_events(self):
        from unittest.mock import patch, MagicMock
        from urllib.error import URLError
        from scripts.stage_nbl_history import fetch_events
        from io import BytesIO
        import json
        response=BytesIO(json.dumps({"events":[{"id":"321"}]}).encode())
        response.__enter__=lambda obj:obj if False else response
        class Stream:
            def __enter__(self):return BytesIO(json.dumps({"events":[{"id":"321"}]}).encode())
            def __exit__(self,*args):return False
        with patch("scripts.stage_nbl_history.urlopen",side_effect=[URLError("timeout"),Stream()]) as request,patch("scripts.stage_nbl_history.time.sleep"):
            self.assertEqual(fetch_events("https://example.com"),[{"id":"321"}])
            self.assertEqual(request.call_count,2)
    def test_missing_events_never_becomes_empty_success(self):
        from unittest.mock import patch
        from scripts.stage_nbl_history import fetch_events
        from io import BytesIO
        class Stream:
            def __enter__(self):return BytesIO(b'{"unexpected":[]}')
            def __exit__(self,*args):return False
        with patch("scripts.stage_nbl_history.urlopen",return_value=Stream()):
            with self.assertRaises(ValueError):fetch_events("https://example.com")
    def test_month_windows_cover_leap_boundary(self):
        windows=list(months(date(2026,2,25),date(2026,4,2)))
        self.assertEqual(windows,[(date(2026,2,25),date(2026,2,28)),(date(2026,3,1),date(2026,3,31)),(date(2026,4,1),date(2026,4,2))])
if __name__=="__main__":unittest.main()

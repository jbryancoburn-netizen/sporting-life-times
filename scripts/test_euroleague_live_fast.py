"""Offline tests for fast EuroLeague scorebug updates and final transitions."""
import datetime as dt
import unittest
import euroleague_live_fast as fast

UTC=dt.timezone.utc
NOW=dt.datetime(2026,10,23,20,30,tzinfo=UTC)
def model(final=False):
    results=[{"id":"70","date":"2026-10-23T18:15:00Z","home":"OLY","away":"ULK","score":[88,82]}] if final else []
    return {"season":"2026-27","updated_at":"2026-10-23T20:25:00+00:00",
        "rankings":[{"code":"OLY","name":"Olympiacos"},{"code":"ULK","name":"Fenerbahce"}]+[
            {"code":"X"+str(n),"name":"Other "+str(n)} for n in range(18)],
        "fixtures":[] if final else [{"id":"70","date":"2026-10-23T18:15:00Z",
            "home":{"code":"OLY","name":"Olympiacos"},"away":{"code":"ULK","name":"Fenerbahce"}}],
        "recent_results":results}
def header(live=True,a=64,b=60):
    return {"Live":live,"CodeTeamA":"OLY","CodeTeamB":"ULK","ScoreA":a,
        "ScoreB":b,"Quarter":"4","RemainingPartialTime":"06:21"}
class FastTests(unittest.TestCase):
    def test_live_updates_from_header(self):
        value=fast.build(model(),{},NOW,lambda _:header())
        g=value["games"][0]
        self.assertEqual((g["status"],g["home"]["score"],g["away"]["score"]),("live",64,60))
        self.assertEqual(value["live_scores_refreshed"],1)
        self.assertEqual(g["score_updated_at"],NOW.isoformat())
    def test_official_final_overrides_live_and_replay(self):
        live=fast.build(model(),{},NOW,lambda _:header())
        completed=fast.build(model(final=True),live,NOW,lambda _:header())
        g=completed["games"][0]
        self.assertEqual((g["status"],g["home"]["score"],g["away"]["score"]),("final",88,82))
        again=fast.build(model(final=True),completed,NOW,lambda _:header())
        self.assertEqual(again["games"][0],g)
    def test_failure_preserves_reported_score_without_claiming_refresh(self):
        old=fast.build(model(),{},NOW,lambda _:header())
        later=NOW+dt.timedelta(minutes=7)
        def broken(_):raise OSError("provider unreachable")
        result=fast.build(model(),old,later,broken)
        self.assertEqual(result["games"][0]["home"]["score"],64)
        self.assertEqual(result["games"][0]["score_updated_at"],NOW.isoformat())
        self.assertEqual(result["live_scores_refreshed"],0)
        self.assertEqual(result["updated_at"],old["updated_at"])
    def test_finished_flag_needs_verification_before_final(self):
        previous=fast.build(model(),{},NOW,lambda _:header())
        waiting=fast.build(model(),previous,NOW+dt.timedelta(minutes=6),lambda _:header(live=False))
        self.assertEqual(waiting["games"][0]["status"],"awaiting_final")
        self.assertEqual(waiting["games"][0]["home"]["score"],64)
        self.assertEqual(waiting["live_scores_refreshed"],0)
    def test_scheduled_has_no_fake_score(self):
        value=fast.build(model(),{},NOW,lambda _:header(live=False))
        self.assertEqual(value["games"][0]["status"],"scheduled")
        self.assertIsNone(value["games"][0]["home"]["score"])
if __name__=="__main__":unittest.main()

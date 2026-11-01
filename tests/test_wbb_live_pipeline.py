"""Offline regression coverage for the women-only, bounded scoreboard refresh."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

MODULE_PATH=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"wbb-season.py"
spec=importlib.util.spec_from_file_location("wbb_season",MODULE_PATH)
wbb=importlib.util.module_from_spec(spec)
spec.loader.exec_module(wbb)

def event(game_id,day,done=True):
    return {
        "id":str(game_id),
        "date":day+"T19:00:00Z",
        "status":{"type":{"completed":done}},
        "competitions":[{"neutralSite":True,"competitors":[
            {"homeAway":"home","team":{"id":"1"},"score":"75" if done else ""},
            {"homeAway":"away","team":{"id":"2"},"score":"78" if done else ""}]}],
    }

class WomenLiveIngestionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=pathlib.Path(self.tmp.name)/"data"
        self.root.mkdir()
        self.original_root=wbb.ROOT
        wbb.ROOT=self.root
        self.addCleanup(setattr,wbb,"ROOT",self.original_root)
        self.teams=[{"team_id":str(i),"team":"School "+str(i),"conference":"Test"} for i in range(1,364)]
        p=patch.object(wbb,"team_registry",return_value=self.teams)
        p.start()
        self.addCleanup(p.stop)

    def load(self,name):
        return json.loads((self.root/name).read_text())

    def test_refresh_checks_six_dates_and_keeps_prior_finals(self):
        (self.root/"ncaaw-2026-27-verified-games.json").write_text(json.dumps({
            "season":"2026-27","games":[{
                "id":"prior","date":"2026-11-01T17:00Z","home_id":"1","away_id":"2",
                "home_score":90,"away_score":89,"neutral":True,"status":"final"}]}))
        calls=[]
        def dates(day):
            calls.append(day.isoformat())
            if day.isoformat()=="2026-11-05":
                return [event("new-final","2026-11-05")]
            if day.isoformat()=="2026-11-07":
                return [event("future","2026-11-07",done=False)]
            return []
        with patch.object(wbb,"daily",side_effect=dates):
            wbb.live(today=wbb.dt.date(2026,11,5))
        self.assertEqual(calls,["2026-11-02","2026-11-03","2026-11-04",
                                "2026-11-05","2026-11-06","2026-11-07"])
        self.assertEqual(len(self.load("ncaaw-2026-27-verified-games.json")["games"]),2)
        release=self.load("ncaaw-2026-27-games.json")
        self.assertEqual(len(release["upcoming"]),1)
        self.assertEqual(release["fetch_window"],{"from":"2026-11-02","through":"2026-11-07"})

    def test_future_fixture_outage_does_not_block_todays_final(self):
        def dates(day):
            if day.isoformat()=="2026-11-03":
                raise OSError("future source temporarily unavailable")
            return [event("new-final","2026-11-01")] if day.isoformat()=="2026-11-01" else []
        with patch.object(wbb,"daily",side_effect=dates):
            wbb.live(today=wbb.dt.date(2026,11,1))
        self.assertEqual(len(self.load("ncaaw-2026-27-verified-games.json")["games"]),1)
        self.assertEqual(self.load("ncaaw-2026-27-games.json")["future_fixture_fetch_warnings"][0]["date"],"2026-11-03")

    def test_current_scoreboard_outage_prevents_publishing_incomplete_finals(self):
        def dates(day):
            if day.isoformat()=="2026-11-01":
                raise OSError("current-day source failed")
            return []
        with patch.object(wbb,"daily",side_effect=dates):
            with self.assertRaisesRegex(RuntimeError,"past/current"):
                wbb.live(today=wbb.dt.date(2026,11,1))
        self.assertFalse((self.root/"ncaaw-2026-27-verified-games.json").exists())

    def test_cached_363_team_registry_can_keep_scoring_when_index_is_down(self):
        (self.root/"ncaaw-2026-27-teams.json").write_text(json.dumps({
            "season":"2026-27","teams":self.teams}))
        with patch.object(wbb,"team_registry",side_effect=RuntimeError("team index offline")),patch.object(wbb,"daily",return_value=[]):
            wbb.live(today=wbb.dt.date(2026,11,1))
        self.assertEqual(self.load("ncaaw-2026-27-teams.json")["count"],363)

    def ncaa_feed(self,home,away,checked_at=None,phase="final"):
        return {"ncaa_women_crosscheck":{
            "provider":"NCAA.com via third-party relay",
            "source_url":"https://ncaa-api.henrygd.me/scoreboard/basketball-women/d1/2026/11/01/all-conf",
            "checked_at":checked_at or wbb.dt.datetime.now(wbb.dt.timezone.utc).isoformat(),
            "games":[{"espn_id":"401920983","home_id":"1","away_id":"2",
                      "home_score":home,"away_score":away,"phase":phase}]}}
    
    def test_ncaa_origin_final_can_complete_same_identified_espn_fixture(self):
        (self.root/"mbb-live.json").write_text(json.dumps(self.ncaa_feed(75,78)))
        with patch.object(wbb,"daily",side_effect=lambda day:
                          [event("401920983","2026-11-01",done=False)]
                          if day.isoformat()=="2026-11-01" else []):
            wbb.live(today=wbb.dt.date(2026,11,1))
        row=self.load("ncaaw-2026-27-verified-games.json")["games"][0]
        self.assertEqual((row["home_score"],row["away_score"]),(75,78))
        self.assertEqual(row["score_evidence"],"ncaa_origin_final_espn_fixture")

    def test_independent_final_score_conflict_blocks_elo_publication(self):
        (self.root/"mbb-live.json").write_text(json.dumps(self.ncaa_feed(74,78)))
        with patch.object(wbb,"daily",side_effect=lambda day:
                          [event("401920983","2026-11-01",done=True)]
                          if day.isoformat()=="2026-11-01" else []):
            with self.assertRaisesRegex(RuntimeError,"score disagreement"):
                wbb.live(today=wbb.dt.date(2026,11,1))
        self.assertFalse((self.root/"ncaaw-2026-27-verified-games.json").exists())

    def test_stale_ncaa_snapshot_does_not_pretend_to_confirm_a_score(self):
        stale=(wbb.dt.datetime.now(wbb.dt.timezone.utc)-wbb.dt.timedelta(hours=3)).isoformat()
        (self.root/"mbb-live.json").write_text(json.dumps(self.ncaa_feed(75,78,checked_at=stale)))
        with patch.object(wbb,"daily",side_effect=lambda day:
                          [event("401920983","2026-11-01",done=True)]
                          if day.isoformat()=="2026-11-01" else []):
            wbb.live(today=wbb.dt.date(2026,11,1))
        row=self.load("ncaaw-2026-27-verified-games.json")["games"][0]
        self.assertEqual(row["score_evidence"],"espn_only")

if __name__=="__main__":
    unittest.main()

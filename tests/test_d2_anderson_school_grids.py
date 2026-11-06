"""Evidence-gated Anderson DII 2026-27 school calendars."""
import json
import unittest
from pathlib import Path

D = json.loads((Path(__file__).resolve().parents[1] / "data/d2-official-school-grids-2026-27.json").read_text(encoding="utf-8"))

class AndersonSchoolCalendarTests(unittest.TestCase):
    def test_two_distinct_eligible_source_snapshots(self):
        for sex, owner, n in (("men","anderson",28),("women","anderson-university-south-carolina",29)):
            s = [s for s in D["schools"] if s.get("gender")==sex and s.get("owner_id")==owner]
            self.assertEqual(len(s),1)
            s=s[0]
            self.assertTrue(s["source_url"].startswith("https://autrojans.com/"))
            self.assertEqual(len(s["fixtures"]),n)
            self.assertEqual(len({(r["date"],r["opponent"]) for r in s["fixtures"]}),n)
            for r in s["fixtures"]:
                self.assertIn(r["role"],("home","away","neutral"))
                self.assertTrue(r["source_opponent"])
                self.assertRegex(r["date"],r"^202[67]-\d\d-\d\d$")
                if r.get("start_time"):
                    self.assertRegex(r["start_time"],r"^(?:[1-9]|1[0-2]):[0-5]\d [AP]M ET$")
            self.assertFalse(any(a.get("gender")==sex and a.get("owner_id")==owner for a in D.get("certification_assertions",[])))

    def test_no_host_tournament_games_or_d1_exhibition_in_dii_elo(self):
        s=next(s for s in D["schools"] if s.get("owner_id")=="anderson-university-south-carolina")
        self.assertEqual(len(s["host_only_excluded_rows"]),2)
        names={r["source_opponent"] for r in s["fixtures"]}
        self.assertNotIn("Wingate vs Belmont Abbey",names)
        self.assertNotIn("Wingate vs Columbus State",names)
        ex=next(r for r in s["fixtures"] if r["date"]=="2026-10-25")
        self.assertIn("Division I exhibition",ex["source_classification"])
        w={r["date"]:r for r in s["fixtures"]}
        self.assertEqual(w["2026-11-20"]["start_time"],"1:00 PM ET")
        self.assertEqual(w["2026-11-21"]["start_time"],"2:00 PM ET")
        self.assertTrue(any("csucougars.com" in u for u in s["source_references"]))

    def test_neutral_and_postseason_source_guards(self):
        s=next(s for s in D["schools"] if s.get("owner_id")=="anderson")
        m={r["date"]:r for r in s["fixtures"]}
        for day in ("2026-11-13","2026-11-14"):
            self.assertEqual(m[day]["role"],"neutral")
            self.assertTrue(m[day]["source_role"])
            self.assertTrue(m[day]["neutral_corroboration"].startswith("https://"))
        self.assertEqual(len(s["unresolved_postseason_source_rows"]),3)
        self.assertFalse(any("Championship" in r["opponent"] for r in s["fixtures"]))


    def test_conflicting_belmont_date_is_held_not_counted_as_confirmed(self):
        school=next(s for s in D["schools"] if s.get("owner_id")=="anderson")
        item=next(x for x in school["fixtures"] if x["date"]=="2026-11-14")
        self.assertEqual(item["source_opponent"],"Belmont Abbey College")
        self.assertTrue(item["hold_for_review"])
        self.assertIn("2026-11-13",item["hold_reason"])
        self.assertIn("abbeyathletics.com",item["conflicting_source_url"])

    def test_importer_revokes_only_unplayed_synthetic_held_game(self):
        import datetime as dt
        import tempfile
        from scripts.build_d2_basketball import apply_official_school_grid_snapshots
        school=next(s for s in D["schools"] if s.get("owner_id")=="anderson")
        held=next(x for x in school["fixtures"] if x["date"]=="2026-11-14")
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/"grid.json"
            p.write_text(json.dumps({"schema":1,"season":"2026-27","schools":[{
                **school,"fixtures":[held]}],
                "live_school_sources":[],"certification_assertions":[]}),encoding="utf-8")
            teams={"anderson":{"id":"anderson","name":"Anderson"},
                   "belmont-abbey":{"id":"belmont-abbey","name":"Belmont Abbey"}}
            stale_id="d2schoolgrid-2026-men-anderson-2026-11-14-belmont-abbey"
            old={"id":stale_id,"date":"2026-11-14","away":"anderson",
                 "home":"belmont-abbey","status":"scheduled","away_score":None,
                 "home_score":None,"source_url":school["source_url"],"neutral":True}
            protected={"id":"6667777","date":"2026-11-14","away":"anderson",
                       "home":"belmont-abbey","status":"final","away_score":71,
                       "home_score":77,"source_url":"https://www.ncaa.com/game/6667777",
                       "ncaa_id":"6667777"}
            games={stale_id:old,"6667777":protected}
            report=apply_official_school_grid_snapshots("men",games,teams,
                today=dt.date(2026,11,5),registry_file=p)
            self.assertEqual(report["held_source_rows"],1)
            self.assertEqual(report["held_synthetic_games_removed"],1)
            self.assertNotIn(stale_id,games)
            self.assertEqual(games["6667777"],protected)
            report=apply_official_school_grid_snapshots("men",games,teams,
                today=dt.date(2026,11,5),registry_file=p)
            self.assertEqual(report["held_source_rows"],1)
            self.assertEqual(report.get("held_synthetic_games_removed",0),0)
            self.assertEqual(len(games),1)

if __name__=="__main__":
    unittest.main()

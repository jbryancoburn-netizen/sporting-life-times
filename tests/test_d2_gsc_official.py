import datetime as dt
import importlib.util
import unittest
from pathlib import Path

MOD=Path(__file__).resolve().parents[1]/"scripts"/"d2_gsc_official.py"
spec=importlib.util.spec_from_file_location("gsc_official_test",MOD)
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)

class GSCOfficialSchedules(unittest.TestCase):
    def test_all_eleven_school_urls_are_exact_and_unique(self):
        self.assertEqual(sorted(collector.SCHOOLS),list(range(3075,3086)))
        self.assertEqual(len({x[1] for x in collector.SCHOOLS.values()}),11)
        self.assertEqual(collector.name_id("at Valdosta State"),"valdosta-state")
        self.assertEqual(collector.name_id("UAH"),"alabama-huntsville")
        self.assertEqual(collector.name_id("Mississippi Christian"),"mississippi-christian")
        self.assertIsNone(collector.name_id("Mystery College"))

    def test_explicit_central_eastern_time_conversions_obey_dst(self):
        self.assertEqual(collector.exact_et("7:30 P.M. CT",dt.date(2026,12,3)),"8:30 PM ET")
        self.assertEqual(collector.exact_et("7:30 P.M. ET",dt.date(2026,12,3)),"7:30 PM ET")
        self.assertEqual(collector.exact_et("5:00 P.M. CT",dt.date(2027,1,2)),"6:00 PM ET")
        self.assertIsNone(collector.exact_et("7:30 P.M.",dt.date(2027,1,2)))
        self.assertIsNone(collector.exact_et("TBA",dt.date(2027,1,2)))

    def test_gsc_parser_accepts_only_verified_conference_games(self):
        dates=[dt.date(2026,12,3)+dt.timedelta(days=i*2) for i in range(20)]
        rows="".join(
            "<tr><td>"+f"{day.month}/{day.day}/{day.year}"+"</td>"
            "<td>at Valdosta State</td><td>Valdosta, GA</td><td>A</td>"
            "<td>*</td><td>7:30 P.M. CT</td></tr>" for day in dates)
        html=("<title>2026-27 UAH Men's Basketball Schedule</title>"
             "<table><tr><th>Date</th><th>Opponent</th><th>Location</th>"
             "<th>Home / Away</th><th>Conference Game</th><th>Time/Result</th></tr>"
             + rows + "</table>")
        found=collector.read_school_schedule(html,"alabama-huntsville",3075)
        self.assertEqual(len(found),20)
        self.assertEqual(found[0]["home"],"valdosta-state")
        self.assertEqual(found[0]["away"],"alabama-huntsville")
        self.assertEqual(found[0]["start_time"],"8:30 PM ET")

    def test_womens_gsc_five_column_schedule_and_utc_offsets(self):
        dates=[dt.date(2026,12,3)+dt.timedelta(days=i*2) for i in range(18)]
        rows="".join(
            "<tr><td>"+f"{day.month}/{day.day}/{day.year}"+"</td>"
            "<td>*</td><td>at Lee</td><td>Cleveland, Tenn.</td>"
            "<td>5:30 P.M. CT</td></tr>" for day in dates)
        html=("<title>2026-27 UAH Women's Basketball Schedule</title>"
             "<table><tr><th>Date</th><th>*</th><th>Opponent</th>"
             "<th>Location</th><th>Time/Result</th></tr>" +rows+"</table>")
        found=collector.read_women_school_schedule(html,
             "university-of-alabama-in-huntsville",3086)
        self.assertEqual(len(found),18)
        self.assertEqual(found[0]["away"],"university-of-alabama-in-huntsville")
        self.assertEqual(found[0]["home"],"lee-university")
        self.assertEqual(found[0]["start_time"],"6:30 PM ET")
        self.assertEqual(found[0]["source_team"],"university-of-alabama-in-huntsville")

    def test_womens_source_typo_does_not_publish_early_morning_tip(self):
        dates=[dt.date(2026,12,3)+dt.timedelta(days=i*2) for i in range(17)]
        rows="".join(
            "<tr><td>"+f"{day.month}/{day.day}/{day.year}"+"</td>"
            "<td>*</td><td>at Lee</td><td>Cleveland, Tenn.</td>"
            "<td>5:30 A.M. CT</td></tr>" for day in dates)
        html=("<title>2026-27 UAH Women's Basketball Schedule</title>"
             "<table><tr><th>Date</th><th>*</th><th>Opponent</th>"
             "<th>Location</th><th>Time/Result</th></tr>" +rows+"</table>")
        found=collector.read_women_school_schedule(html,
             "university-of-alabama-in-huntsville",3086)
        self.assertTrue(all(g["start_time"] is None for g in found))

    def test_only_reciprocal_school_sources_create_scheduled_games(self):
        a={"date":"2026-12-03","away":"alabama-huntsville","home":"valdosta-state",
           "source_team":"alabama-huntsville","source_url":"https://gscsports.org/schedule.aspx?schedule=3075",
           "city":"Valdosta, GA","start_time":"8:00 PM ET"}
        b={**a,"source_team":"valdosta-state",
           "source_url":"https://gscsports.org/schedule.aspx?schedule=3084"}
        games={};teams={x:{"id":x} for x in ("alabama-huntsville","valdosta-state")}
        info=collector.reconcile_schedules({"alabama-huntsville":[a]},games,teams,dt.date(2026,11,1))
        self.assertEqual(info["new_games"],0)
        self.assertEqual(info["unreciprocated"],1)
        info=collector.reconcile_schedules({"alabama-huntsville":[a],"valdosta-state":[b]},
            games,teams,dt.date(2026,11,1))
        self.assertEqual(info["new_games"],1)
        g=next(iter(games.values()))
        self.assertEqual(g["start_time"],"8:00 PM ET")
        self.assertEqual(g["network"],"FloCollege")
        self.assertNotIn("stream_url",g)
        self.assertNotIn("venue",g)
        self.assertFalse(g["neutral"])
        self.assertEqual(len(g["official_schedule_sources"]),2)
        info2=collector.reconcile_schedules({"alabama-huntsville":[a],"valdosta-state":[b]},
            games,teams,dt.date(2026,11,1))
        self.assertEqual(info2["existing_games_enriched"],1)
        self.assertEqual(info2["new_games"],0)
        self.assertEqual(len(games),1)

    def test_host_school_resolves_only_documented_cbu_time_conflict(self):
        key=("2027-01-21","mississippi-christian","christian-brothers")
        a={"date":key[0],"away":key[1],"home":key[2],
           "source_team":key[1],"source_url":"https://gscsports.org/schedule.aspx?schedule=3080",
           "city":"Memphis, TN","start_time":"8:30 PM ET"}
        b={**a,"source_team":key[2],
           "source_url":"https://gscsports.org/schedule.aspx?schedule=3077",
           "start_time":"8:00 PM ET"}
        games={};teams={name:{"id":name} for name in key[1:]}
        result=collector.reconcile_schedules({key[1]:[a],key[2]:[b]},
            games,teams,dt.date(2026,11,1))
        self.assertEqual(result["confirmed_matchups"],1)
        self.assertEqual(result["host_verified_resolutions"],1)
        self.assertEqual(result["time_conflicts"],0)
        g=next(iter(games.values()))
        self.assertEqual(g["start_time"],"8:00 PM ET")
        self.assertEqual(g["venue"],"Canale Arena · Memphis, TN")
        self.assertEqual(g["venue_source_url"],"https://cbubucs.com/sports/mens-basketball/schedule")

    def test_conflicting_time_does_not_replace_verified_tipoff(self):
        a={"date":"2026-12-03","away":"alabama-huntsville","home":"valdosta-state",
           "source_team":"alabama-huntsville","source_url":"https://gscsports.org/schedule.aspx?schedule=3075",
           "city":"Valdosta, GA","start_time":"8:00 PM ET"}
        b={**a,"source_team":"valdosta-state",
           "source_url":"https://gscsports.org/schedule.aspx?schedule=3084","start_time":"9:00 PM ET"}
        old={"id":"ncaa-id","date":"2026-12-03","away":"alabama-huntsville","home":"valdosta-state",
             "status":"scheduled","start_time":"8:15 PM ET","source_url":"https://www.ncaa.com/game/123"}
        games={old["id"]:old};teams={x:{"id":x} for x in ("alabama-huntsville","valdosta-state")}
        q=collector.reconcile_schedules({"alabama-huntsville":[a],"valdosta-state":[b]},
            games,teams,dt.date(2026,11,1))
        self.assertEqual(q["time_conflicts"],1)
        self.assertEqual(old["start_time"],"8:15 PM ET")
        self.assertEqual(old["id"],"ncaa-id")
        self.assertEqual(old["source_url"],"https://www.ncaa.com/game/123")
if __name__=="__main__":unittest.main()

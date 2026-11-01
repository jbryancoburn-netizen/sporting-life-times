import datetime as dt
import importlib.util
import unittest
from pathlib import Path

SPEC=importlib.util.spec_from_file_location("official_cacc",Path(__file__).resolve().parents[1]/"scripts"/"d2_cacc_official.py")
cacc=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cacc)

class CACCOfficialTests(unittest.TestCase):
 def test_registry_has_all_eleven_certified_schools_not_monroe(self):
  self.assertEqual(len(cacc.SCHOOLS),11)
  self.assertNotIn("monroe-university",{k for _,k in cacc.SCHOOLS.values()})
  self.assertIsNone(cacc.opponent_id("at Monroe University"))
  self.assertEqual(cacc.opponent_id("at Holy Family University"),"holy-family")
  self.assertEqual(cacc.opponent_id("Jefferson"),"jefferson-thomas-jefferson")

 def test_cacc_published_eastern_times_do_not_guess_tba(self):
  self.assertEqual(cacc.eastern_time("7:30 P.M."),"7:30 PM ET")
  self.assertEqual(cacc.eastern_time("12:00 P.M."),"12:00 PM ET")
  self.assertEqual(cacc.eastern_time("12:15 A.M."),"12:15 AM ET")
  self.assertIsNone(cacc.eastern_time("TBA"))

 def test_parse_2026_27_sidearm_table_with_home_away_and_provisional_opponent(self):
  games=[]
  for i in range(20):
   date=dt.date(2026,12,1)+dt.timedelta(days=i*3)
   opp="at Holy Family University" if i%2 else "Holy Family University"
   games.append(f"<tr><td>{date.month}/{date.day}/{date.year}</td><td>7:30 P.M.</td><td>{opp}</td><td>Philadelphia, PA</td><td>7:30 P.M.</td><td></td></tr>")
  games.append("<tr><td>1/2/2027</td><td>7:00 P.M.</td><td>at Monroe University</td><td>New Rochelle, NY</td><td>7:00 P.M.</td><td></td></tr>")
  games.append("<tr><td>1/3/2027</td><td>6:00 P.M.</td><td>vs. Southern New Hampshire University</td><td></td><td>6:00 P.M.</td><td></td></tr>")
  html="<h1>2026-27 Caldwell Men's Basketball Schedule</h1><table><tr><th>Date</th><th>TIme</th><th>Opponent</th><th>Location</th><th>Result</th><th>Event</th></tr>"+"".join(games)+"</table>"
  got=cacc.parse_cacc_school(html,"caldwell",2381)
  self.assertEqual(len(got),20)
  self.assertEqual(got[0]["home"],"caldwell")
  self.assertEqual(got[1]["away"],"caldwell")
  self.assertEqual(got[1]["tipoff"],"7:30 PM ET")

 def test_exact_sidearm_duplicate_with_complementary_city_is_one_fixture(self):
  rows=[]
  for i in range(19):
   date=dt.date(2026,12,1)+dt.timedelta(days=3*i)
   rows.append(f"<tr><td>{date.month}/{date.day}/{date.year}</td><td>7:00 P.M.</td><td>at Caldwell University</td><td>Caldwell, NJ</td><td>7:00 P.M.</td><td></td></tr>")
  rows+=["<tr><td>2/6/2027</td><td>3:30 P.M.</td><td>Georgian Court University</td><td></td><td>3:30 P.M.</td><td></td></tr>",
         "<tr><td>2/6/2027</td><td>3:30 P.M.</td><td>Georgian Court University</td><td>Rutherford, NJ</td><td>3:30 P.M.</td><td></td></tr>"]
  html="<h1>2026-27 Felician Men's Basketball Schedule</h1><table><tr><th>Date</th><th>TIme</th><th>Opponent</th><th>Location</th><th>Result</th><th>Event</th></tr>"+"".join(rows)+"</table>"
  result=cacc.parse_cacc_school(html,"felician",2388)
  self.assertEqual(len(result),20)
  game=next(x for x in result if x["date"]=="2027-02-06")
  self.assertEqual(game["city"],"Rutherford, NJ")

 def test_conflicting_duplicate_is_not_auto_merged(self):
  dates=[dt.date(2026,12,1)+dt.timedelta(days=i*3) for i in range(19)]
  rows="".join(f"<tr><td>{d.month}/{d.day}/{d.year}</td><td>3:00 P.M.</td><td>Georgian Court University</td><td></td><td>3:00 P.M.</td><td></td></tr>" for d in dates)
  rows+="<tr><td>2/6/2027</td><td>3:30 P.M.</td><td>Georgian Court University</td><td></td><td></td><td></td></tr>"
  rows+="<tr><td>2/6/2027</td><td>5:30 P.M.</td><td>Georgian Court University</td><td></td><td></td><td></td></tr>"
  html="<h1>2026-27 Felician Men's Basketball Schedule</h1><table><tr><th>Date</th><th>TIme</th><th>Opponent</th><th>Location</th><th>Result</th><th>Event</th></tr>"+rows+"</table>"
  with self.assertRaisesRegex(ValueError,"Conflicting duplicate"):
   cacc.parse_cacc_school(html,"felician",2388)

 def test_two_independent_2026_27_schedules_required_to_add_game(self):
  a={"date":"2026-12-10","away":"caldwell","home":"holy-family","tipoff":"8:00 PM ET",
     "source_team":"caldwell","source_url":"https://caccathletics.org/schedule.aspx?schedule=2381","city":"Philadelphia, PA"}
  b={**a,"source_team":"holy-family","source_url":"https://caccathletics.org/schedule.aspx?schedule=2387"}
  teams={x:{"id":x} for x in ("caldwell","holy-family")}
  games={}
  q=cacc.reconcile_cacc({"caldwell":[a]},games,teams,dt.date(2026,11,1))
  self.assertEqual(q["added"],0)
  self.assertEqual(q["unreciprocated"],1)
  q=cacc.reconcile_cacc({"caldwell":[a],"holy-family":[b]},games,teams,dt.date(2026,11,1))
  self.assertEqual(q["added"],1)
  game=next(iter(games.values()))
  self.assertEqual(game["start_time"],"8:00 PM ET")
  self.assertNotIn("network",game)
  self.assertNotIn("venue",game)
  self.assertEqual(len(game["conference_schedule_sources"]),2)
  q=cacc.reconcile_cacc({"caldwell":[a],"holy-family":[b]},games,teams,dt.date(2026,11,1))
  self.assertEqual(q["enriched"],1)
  self.assertEqual(len(games),1)

 def test_host_athletics_evidence_resolves_disagreeing_cacc_times(self):
  date,away,home="2027-02-16","wilmington","georgian-court"
  a={"date":date,"away":away,"home":home,"source_team":away,
     "source_url":"https://caccathletics.org/schedule.aspx?schedule=2377",
     "tipoff":"8:00 PM ET","city":"Lakewood, NJ"}
  b={**a,"source_team":home,"source_url":"https://caccathletics.org/schedule.aspx?schedule=2389",
     "tipoff":"7:00 PM ET"}
  teams={k:{"id":k} for k in (away,home)}
  games={}
  report=cacc.reconcile_cacc({away:[a],home:[b]},games,teams,dt.date(2026,11,1))
  self.assertEqual(report["host_sourced_resolutions"],1)
  self.assertEqual(report["time_disagreements"],0)
  self.assertEqual(report["verified_watch_links"],1)
  g=next(iter(games.values()))
  self.assertEqual(g["start_time"],"7:00 PM ET")
  self.assertEqual(g["venue"],"GCU Wellness Center · Lakewood, NJ")
  self.assertEqual(g["network"],"CACC Network")
  self.assertTrue(g["stream_url"].startswith("https://caccnetwork.com/"))

 def test_unverified_host_or_mismatched_host_time_leaves_conflict(self):
  date,away,home="2027-01-16","jefferson-thomas-jefferson","bridgeport"
  a={"date":date,"away":away,"home":home,"source_team":away,
      "source_url":"https://caccathletics.org/schedule.aspx?schedule=2385",
      "city":"Bridgeport, CT","tipoff":"2:00 PM ET"}
  b={**a,"source_team":home,"source_url":"https://caccathletics.org/schedule.aspx?schedule=2384",
      "tipoff":"3:00 PM ET"}
  teams={k:{"id":k} for k in (away,home)};games={}
  q=cacc.reconcile_cacc({away:[a],home:[b]},games,teams,dt.date(2026,11,1))
  self.assertEqual(q["time_disagreements"],1)
  self.assertEqual(q["host_sourced_resolutions"],0)
  self.assertNotIn("start_time",next(iter(games.values())))

 def test_invalid_member_cannot_be_confirmed_as_dii_opponent(self):
  a={"date":"2026-12-10","away":"monroe-university","home":"caldwell",
     "source_team":"monroe-university","tipoff":"8:00 PM ET","source_url":"https://invalid","city":""}
  b={**a,"source_team":"caldwell"}
  q=cacc.reconcile_cacc({"monroe-university":[a],"caldwell":[b]}, {},
    {"caldwell":{"id":"caldwell"},"monroe-university":{"id":"monroe-university","not_eligible_for_dii_elo":True}},dt.date(2026,11,1))
  self.assertEqual(q["confirmed_matchups"],0)
  self.assertEqual(q["identity_conflicts"],1)

if __name__=="__main__":
 unittest.main()

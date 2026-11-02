"""Women-only source-site claims must never be treated as settled home court."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

PATH=pathlib.Path(__file__).resolve().parents[1]/"scripts/wbb-verify-official-schools.py"
spec=importlib.util.spec_from_file_location("wbb_official_site_test",PATH)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class OfficialSites(unittest.TestCase):
 def test_sidearm_vs_prefix_is_not_neutral_site_proof(self):
  html="<div class='sidearm-schedule-game' data-game-id='456'>"+(
   "<span class='sidearm-schedule-game-opponent-text'>vs. Villanova</span>"
   "<span class='sidearm-schedule-game-opponent-date'>Nov 11, 2026</span></div>")
  rows=mod.read_source(html)
  self.assertEqual(rows[0]["site"],"home")
  self.assertEqual(rows[0]["site_evidence"],"vs_prefix")
  self.assertNotEqual(rows[0]["site_evidence"],"explicit_site_column")

 def test_explicit_school_neutral_marker_retains_its_stronger_evidence(self):
  html="<div class='sidearm-schedule-game' data-game-id='456'>"+(
   "<span class='sidearm-schedule-game-opponent-text'>vs. Villanova</span>"
   "<span class='sidearm-schedule-game-opponent-date'>Nov 11, 2026</span>"
   "<div class='sidearm-schedule-game-neutral'>Neutral site</div></div>")
  rows=mod.read_source(html)
  self.assertEqual(rows[0]["site"],"neutral")
  self.assertEqual(rows[0]["site_evidence"],"neutral_markup")

 def test_explicit_table_site_beats_vs_prefix(self):
  html="<table><tr><th>Date</th><th>Opponent</th><th>Site</th></tr>"+(
   "<tr><td>Nov 11, 2026</td><td>vs. Villanova</td><td>Neutral</td></tr></table>")
  rows=mod.read_source(html)
  self.assertEqual(rows[0]["site"],"neutral")
  self.assertEqual(rows[0]["site_evidence"],"explicit_site_column")

 def test_university_mismatch_is_logged_without_changing_game_id_or_site(self):
  rows=[
   dict(date=f"2026-11-{i:02d}",opponent=f"School {i}",site=("home" if i==11 else "away"),
        origin="official_university_schedule_table",site_evidence=("vs_prefix" if i==11 else "explicit_site_column"))
   for i in range(11,16)]
  games=[dict(id=str(401000000+i),date=f"2026-11-{i:02d}T17:00:00Z",
              site=("neutral" if i==11 else "away"),
              opponent=f"School {i}",opponent_id=str(1000+i)) for i in range(11,16)]
  uni=dict(team="Auburn Tigers",games=games)
  response=type("Response",(),{"ok":True,"url":"https://auburntigers.com/sports/womens-basketball/schedule","text":"<table></table>"})()
  with patch.object(mod,"official_urls",return_value=[response.url]),\
       patch.object(mod.requests,"get",return_value=response),\
       patch.object(mod,"read_source",return_value=rows):
   result=mod.school("2",uni,{})
  self.assertEqual(result["site_conflicts"],1)
  self.assertEqual(len(result["site_conflict_cases"]),1)
  case=result["site_conflict_cases"][0]
  self.assertEqual(case["game_id"],"401000011")
  self.assertEqual(case["published_site"],"neutral")
  self.assertEqual(case["university_listed_site"],"home")
  self.assertEqual(case["site_evidence"],"vs_prefix")
  self.assertEqual(case["review_classification"],"ambiguous_vs_at_neutral_site")
  self.assertEqual(result["site_inferred_matches"],0)
  self.assertEqual(case["source_url"],response.url)
  self.assertNotIn("home_away",result["evidence"][0]["verified_fields"])
  self.assertEqual(games[0]["site"],"neutral","the current schedule cannot be rewritten by an inference")

 def test_an_undisputed_vs_does_not_certify_a_home_game(self):
  rows=[dict(date=f"2026-11-{i:02d}",opponent=f"School {i}",site="home",
       origin="official_university_sidearm_card",site_evidence="vs_prefix") for i in range(11,16)]
  games=[dict(id=str(401000000+i),date=f"2026-11-{i:02d}T17:00:00Z",
      site="home",opponent=f"School {i}",opponent_id=str(1000+i)) for i in range(11,16)]
  resp=type("Response",(),{"ok":True,"url":"https://auburntigers.com/sports/womens-basketball/schedule","text":"<div></div>"})()
  with patch.object(mod,"official_urls",return_value=[resp.url]),\
       patch.object(mod.requests,"get",return_value=resp),\
       patch.object(mod,"read_source",return_value=rows):
   result=mod.school("2",dict(team="Auburn Tigers",games=games),{})
  self.assertEqual(result["site_conflicts"],0)
  self.assertEqual(result["site_matched"],0)
  self.assertEqual(result["site_inferred_matches"],5)
  self.assertTrue(all(x["verified_fields"]==["scheduled_date","opponent"] for x in result["evidence"]))


 def test_curated_short_names_match_correct_women_teams_only(self):
  examples=[
   ("TCU","2628","TCU Horned Frogs"),
   ("Navy","2426","Navy Midshipmen"),
   ("BYU","252","BYU Cougars"),
   ("IU Indy","85","IU Indianapolis Jaguars"),
   ("LMU","2351","Loyola Marymount Lions"),
   ("CSUN","2463","Cal State Northridge Matadors"),
   ("Penn","219","Pennsylvania Quakers"),
   ("USC Upstate","2908","South Carolina Upstate Spartans"),
   ("CCSU","2115","Central Connecticut Blue Devils"),
  ]
  for short,tid,full in examples:
   with self.subTest(alias=short):
    self.assertTrue(mod.official_opponent_matches(short,{"opponent_id":tid,"opponent":full},{}))
    self.assertTrue(mod.official_opponent_matches("at "+short,{"opponent_id":tid,"opponent":full},{}))
  self.assertFalse(mod.official_opponent_matches("Penn State",{"opponent_id":"219","opponent":"Pennsylvania Quakers"},{}))
  self.assertFalse(mod.official_opponent_matches("Ohio State",{"opponent_id":"195","opponent":"Ohio Bobcats"},{}))
  self.assertFalse(mod.official_opponent_matches("Utah State",{"opponent_id":"254","opponent":"Utah Utes"},{}))
  self.assertFalse(mod.official_opponent_matches("TCU",{"opponent_id":"252","opponent":"BYU Cougars"},{}))
  self.assertFalse(mod.official_opponent_matches("BYU",{"opponent_id":"2628","opponent":"TCU Horned Frogs"},{}))


 def test_verified_short_school_aliases_reconcile_only_existing_opponents(self):
  examples=(
   ("vs. Navy","2426","Navy Midshipmen"),
   ("at BYU","252","BYU Cougars"),
   ("TCU","2628","TCU Horned Frogs"),
   ("UAB","5","UAB Blazers"),
   ("CSUN","2463","Cal State Northridge Matadors"),
   ("UNLV","2439","UNLV Lady Rebels"),
   ("IU Indy","85","IU Indianapolis Jaguars"),
   ("UMBC","2378","UMBC Retrievers"),
   ("UTEP","2638","UTEP Miners"),
   ("CCSU","2115","Central Connecticut Blue Devils"),
   ("Loyola Marymount","2351","Loyola Marymount Lions"),
   ("USC Upstate","2908","South Carolina Upstate Spartans"),
  )
  for official_printed, opponent_id, full_name in examples:
   with self.subTest(official_printed=official_printed):
    self.assertTrue(mod.official_opponent_matches(
      official_printed,{"opponent_id":opponent_id,"opponent":full_name},{}))
  # Matching a printed shorthand is NOT authority to synthesize a game,
  # infer its home court, or override an existing opponent identity.

 def test_shared_prefixes_cannot_swallow_different_division_one_schools(self):
  collisions=(
   ("Utah State","254","Utah Utes"),
   ("Ohio State","195","Ohio Bobcats"),
   ("UMass Lowell","113","Massachusetts Minutewomen"),
   ("USC Upstate","30","USC Trojans"),
   ("Iowa State","2294","Iowa Hawkeyes"),
   ("Arizona State","12","Arizona Wildcats"),
   ("California Baptist","25","California Golden Bears"),
  )
  for printed,opponent_id,full_name in collisions:
   with self.subTest(printed=printed):
    self.assertFalse(mod.official_opponent_matches(
      printed,{"opponent_id":opponent_id,"opponent":full_name},{}))



if __name__=="__main__":
 unittest.main()

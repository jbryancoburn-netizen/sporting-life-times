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
  self.assertEqual(case["source_url"],response.url)
  self.assertNotIn("home_away",result["evidence"][0]["verified_fields"])
  self.assertEqual(games[0]["site"],"neutral","the current schedule cannot be rewritten by an inference")


if __name__=="__main__":
 unittest.main()

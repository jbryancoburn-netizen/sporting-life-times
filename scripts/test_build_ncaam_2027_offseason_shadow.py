#!/usr/bin/env python3
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("offseason",Path(__file__).with_name("build_ncaam_2027_offseason_shadow.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ShadowTests(unittest.TestCase):
 def test_player_ids_take_precedence_and_transfer_is_not_returner(self):
  prior=[{"team_ncaa_team_id":"22","clean_name":"Robin Gold","player_id":"77","mins":"55"},
         {"team_ncaa_team_id":"33","clean_name":"Peter Silver","player_id":"88","mins":"52"}]*20
  current={"rosters":[{"ncaa_id":"ncaa:33","school":"Team B","url":"https://example.org",
      "players":[{"id":"77","name":"Robin Gold"},{"id":"88","name":"Peter Silver"}]+[
      {"id":str(i),"name":"Other "+str(i)} for i in range(8)]}]}
  values,counts=m.features(prior,current)
  self.assertEqual(counts["exact_id_matches"],2)
  self.assertAlmostEqual(values["ncaa:33"]["retention"],1)
  self.assertAlmostEqual(values["ncaa:33"]["incoming_minutes"],1100/1040,places=5)
 def test_duplicate_athlete_does_not_inflate_minutes(self):
  prior=[{"team_ncaa_team_id":"33","clean_name":"Peter Silver","player_id":"88","mins":"52"}]*20
  current={"rosters":[{"ncaa_id":"ncaa:33","school":"Team B","players":[{"id":"88","name":"Peter Silver"},{"id":"88","name":"Peter Silver"}]+[
      {"id":str(i),"name":"Other "+str(i)} for i in range(8)]}]}
  values,counts=m.features(prior,current)
  self.assertEqual(values["ncaa:33"]["matched_returning_minutes"],1040)
if __name__=="__main__":unittest.main()

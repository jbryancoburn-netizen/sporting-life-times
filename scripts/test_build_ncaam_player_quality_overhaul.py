import json,unittest
from pathlib import Path
from build_ncaam_player_quality_overhaul import build
class PlayerQualityOverhaulTests(unittest.TestCase):
 def setUp(self):
  d=Path("data"); load=lambda x:json.loads((d/x).read_text())
  self.args=[load("ncaam-2026-27-preseason-provisional.json"),
    load("ncaam-2026-27-preseason-roster-informed.json"),
    load("ncaam-2026-27-player-scoring-shadow.json"),
    load("ncaam-2026-27-scoring-quality-shadow.json")]
 def test_all_team_identities_and_replay(self):
  out=build(*self.args)
  self.assertEqual(len(out["rankings"]),365)
  self.assertEqual(len({t["team_id"] for t in out["rankings"]}),365)
  self.assertTrue(all(x["rank"]==i for i,x in enumerate(out["rankings"],1)))
  self.assertTrue(all(abs(x["elo"]-x["base_elo"]-x["offseason_adjustment"])<0.00021 for x in out["rankings"]))
  self.assertFalse(out["production_elo_approved"])
  self.assertFalse(out["preseason_asof_certified"])
 def test_zero_adjustment_returns_exact_base(self):
  out=build(*self.args,transfer_weight=0,roster_weight=0,scoring_weight=0)
  base={t["team_id"]:t["elo"] for t in self.args[0]["rankings"]}
  self.assertTrue(all(x["elo"]==base[x["team_id"]] for x in out["rankings"]))
 def test_inputs_not_mutated(self):
  before=json.dumps(self.args,sort_keys=True)
  build(*self.args)
  self.assertEqual(before,json.dumps(self.args,sort_keys=True))
 def test_invalid_scenario_fails(self):
  with self.assertRaises(AssertionError):build(*self.args,transfer_weight=1.5)
if __name__=="__main__":unittest.main()

import unittest
from backtest_ncaam_opponent_quality import quality_continuity
class TrueShootingEvidenceTests(unittest.TestCase):
    def fixtures(self):
        box=[{"team":"Old School","player_id":"91","clean_name":"Taylor Example","mins":"25",
              "pts":"15","fga":"10","fta":"4","contest_id":str(i)} for i in range(45)]
        roster=[{"team":"New School","player":"Taylor Example"}]
        strength={"oldschool":{"91":{"minutes":1125,"opponent_pregame_elo":1640}}}
        return box,roster,strength
    def test_true_shooting_uses_measured_attempts(self):
        box,roster,strength=self.fixtures()
        opponent,scoring,efficiency=quality_continuity(box,roster,{"newschool"},strength,
               {"oldschool":1600.},return_scoring=True)
        self.assertAlmostEqual(opponent["newschool"],40)
        self.assertAlmostEqual(scoring["newschool"],0)
        self.assertAlmostEqual(efficiency["newschool"],15/(2*(10+.44*4)))
    def test_missing_attempts_excluded_not_zeroed(self):
        box,roster,strength=self.fixtures()
        for row in box:row.pop("fta")
        _,_,efficiency=quality_continuity(box,roster,{"newschool"},strength,
              {"oldschool":1600.},return_scoring=True)
        self.assertNotIn("newschool",efficiency)
if __name__=="__main__":unittest.main()

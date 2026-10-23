import unittest
from backtest_ncaam_opponent_quality import quality_continuity

class QualityContinuityTests(unittest.TestCase):
    def test_unique_player_prior_competition(self):
        box=[{"team":"Old School","player_id":"91","clean_name":"Taylor Example","mins":"25"}]
        roster=[{"team":"New School","player":"Taylor Example"}]
        quality={"oldschool":{"91":{"minutes":400,"opponent_pregame_elo":1640}}}
        got=quality_continuity(box,roster,{"newschool"},quality)
        self.assertEqual(got, {})
    def test_source_school_strength_residual(self):
        box=[{"team":"Old School","player_id":"91","clean_name":"Taylor Example","mins":"25"}]
        roster=[{"team":"New School","player":"Taylor Example"}]
        quality={"oldschool":{"91":{"minutes":400,"opponent_pregame_elo":1640}}}
        # At least 1000 observed historical minutes are needed.
        box=[dict(box[0],contest_id=str(i)) for i in range(45)]
        result=quality_continuity(box,roster,{"newschool"},quality,{"oldschool":1600.})
        self.assertAlmostEqual(result["newschool"],40.)
    def test_ambiguous_same_name_rejected(self):
        box=[{"team":"Old School","player_id":"91","clean_name":"Taylor Example","mins":"25"},
             {"team":"Other School","player_id":"92","clean_name":"Taylor Example","mins":"25"}]
        roster=[{"team":"New School","player":"Taylor Example"}]
        quality={"oldschool":{"91":{"minutes":400,"opponent_pregame_elo":1640}}}
        self.assertEqual(quality_continuity(box,roster,{"newschool"},quality),{})
if __name__=="__main__":unittest.main()

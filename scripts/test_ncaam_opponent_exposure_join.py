"""Source-ID linkage tests for 2026-27 opponent adjusted player histories."""
import unittest
from join_ncaam_opponent_exposure import join

class OpponentJoinTests(unittest.TestCase):
    def fixture(self):
        exposure={"player_exposure":[{"historical_player_id":"102","historical_team_id":"ncaa:9","minutes":800,"opponent_pregame_elo":1530}]}
        movement={"teams":[{"team_id":"ncaa:10","players":[{"current_id":"55","player":"Example Player","prior_school_id":"ncaa:9"}]}]}
        cross={"linked_count":1,"links":[{"id":"55","pid":"102","prior":"ncaa:9","method":"name_jersey"}]}
        return exposure,movement,cross
    def test_exact_identity_and_school_join(self):
        result=join(*self.fixture())
        self.assertEqual(result["linked_count"],1)
        self.assertEqual(result["records"][0]["opponent_pregame_elo"],1530)
        self.assertFalse(result["production_elo_changed"])
    def test_wrong_prior_school_blocked(self):
        e,m,c=self.fixture();c["links"][0]["prior"]="ncaa:11"
        self.assertEqual(join(e,m,c)["linked_count"],0)
    def test_prior_player_id_collision_on_other_school_not_accepted(self):
        e,m,c=self.fixture();e["player_exposure"][0]["historical_team_id"]="ncaa:8"
        self.assertEqual(join(e,m,c)["linked_count"],0)
    def test_fuzzy_match_excluded(self):
        e,m,c=self.fixture();c["links"][0]["method"]="jaro_winkler"
        self.assertEqual(join(e,m,c)["linked_count"],0)
    def test_duplicate_current_athlete_rejected(self):
        e,m,c=self.fixture();m["teams"][0]["players"].append(dict(m["teams"][0]["players"][0]))
        with self.assertRaisesRegex(ValueError,"Duplicate player identities"):
            join(e,m,c)
    def test_duplicate_historical_identity_excluded(self):
        e,m,c=self.fixture();e["player_exposure"].append(dict(e["player_exposure"][0]))
        self.assertEqual(join(e,m,c)["linked_count"],0)
if __name__=="__main__":unittest.main()

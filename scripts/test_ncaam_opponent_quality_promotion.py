import unittest
from verify_ncaam_opponent_quality_promotion import decision
class OpponentReleaseGate(unittest.TestCase):
    def sample(self):
        return {"training_winner":{},"holdout_baseline":{},"holdout_adjusted":{},
         "holdout_all_games_game_only":{"games":1500,"log_loss":0.56,"brier":0.19},
         "holdout_all_games_enhanced_with_fallback":{"games":1500,"log_loss":0.55,"brier":0.18},
         "holdout_fallback_window_sensitivity":{},
         "training_grid_edge_solution":False,"fallback_all_windows_improve_both_metrics":True,
         "preseason_information_integrity_verified":False}
    def test_no_preseason_provenance_blocks_release(self):
        self.assertFalse(decision(self.sample())["approved"])
    def test_unequal_coverage_blocks_release(self):
        r=self.sample();r["preseason_information_integrity_verified"]=True
        r["holdout_all_games_enhanced_with_fallback"]["games"]=1450
        self.assertFalse(decision(r)["approved"])
    def test_worse_brier_blocks_release(self):
        r=self.sample();r["preseason_information_integrity_verified"]=True
        r["holdout_all_games_enhanced_with_fallback"]["brier"]=0.20
        self.assertFalse(decision(r)["approved"])
    def test_all_gates_can_pass_in_fixture(self):
        r=self.sample();r["preseason_information_integrity_verified"]=True
        self.assertTrue(decision(r)["approved"])
if __name__=="__main__":unittest.main()

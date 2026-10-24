import unittest
from verify_ncaam_accuracy_first_promotion import decision
class AccuracyRuleTests(unittest.TestCase):
    def record(self):
        return {"train_seasons":[2024,2025],"untouched_holdout_season":2026,
          "training_grid_boundary":False,"preseason_asof_certified":True,
          "current_feature_formula_equal_to_historical":True,
          "features":{"selected_quality_beta":1000},
          "holdout_minutes_only":{"games":1658,"log_loss":.56,"brier":.19},
          "holdout_minutes_plus_quality":{"games":1658,"log_loss":.54,"brier":.18}}
    def test_large_coefficient_never_blocks_accuracy(self):
        row=self.record();row["features"]["selected_quality_beta"]=1000000
        self.assertTrue(decision(row)["promotion_approved"])
    def test_big_rank_changes_never_block(self):
        row=self.record();row["maximum_team_rank_movement"]=350
        self.assertTrue(decision(row)["promotion_approved"])
    def test_worse_predictions_rejected(self):
        row=self.record();row["holdout_minutes_plus_quality"]["brier"]=.20
        self.assertFalse(decision(row)["promotion_approved"])
    def test_retrospective_roster_rejected(self):
        row=self.record();row["preseason_asof_certified"]=False
        self.assertFalse(decision(row)["promotion_approved"])
    def test_mismatched_formula_rejected(self):
        row=self.record();row["current_feature_formula_equal_to_historical"]=False
        self.assertFalse(decision(row)["promotion_approved"])
    def test_boundary_rejected(self):
        row=self.record();row["training_grid_boundary"]=True
        self.assertFalse(decision(row)["promotion_approved"])
if __name__=="__main__":unittest.main()

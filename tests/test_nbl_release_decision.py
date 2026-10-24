import unittest
from scripts.nbl_release_decision import decide

class NBLReleaseDecisionTests(unittest.TestCase):
    def fixture(self):
        audit={"2025_26_regular_season_coverage":{"status":"pass"}}
        evaluation={"publication_approved":False,
            "season_predictions":{"2024-25":{"games":159,"log_loss":.67,"brier":.24},
            "2025-26":{"games":178,"log_loss":.63,"brier":.22},
            "2026-27":{"games":41,"log_loss":.71,"brier":.26}},
            "coin_flip_baseline":{"log_loss":.693147},
            "prior_season_home_rate_baseline":{"2026-27":{"log_loss":.69}}}
        return audit,evaluation
    def test_withholds_even_with_valid_historical_results(self):
        a,b=self.fixture()
        d=decide(a,b)
        self.assertEqual(d["status"],"withheld")
        self.assertFalse(d["production_approved"])
        self.assertEqual(d["current_season_games_tested"],41)
        self.assertFalse(d["requires_future_results_to_run"])
    def test_missing_metrics_cannot_be_reported_as_valid_evidence(self):
        a,b=self.fixture()
        del b["season_predictions"]["2026-27"]["log_loss"]
        result=decide(a,b)
        self.assertFalse(result["audit_input_valid"])
        self.assertFalse(result["production_approved"])
    def test_valid_evidence_can_still_withhold_an_unvalidated_model(self):
        a,b=self.fixture()
        result=decide(a,b)
        self.assertTrue(result["audit_input_valid"])
        self.assertEqual(result["status"],"withheld")
    def test_validation_selected_model_fails_holdout_even_if_validation_won(self):
        a,b=self.fixture()
        selection={"selected_from_validation":{"k":32,"home_advantage_elo":25,"regression":.15,
                        "validation_log_loss":.623258},
                   "selected_holdout":{"log_loss":.742054},
                   "incumbent_holdout":{"log_loss":.709414}}
        d=decide(a,b,selection)
        self.assertFalse(d["parameter_selection_audit"]["selected_model_beats_coinflip"])
        self.assertFalse(d["parameter_selection_audit"]["promotion_allowed"])
        self.assertIn("Validation-selected Elo fails untouched current-season benchmark",d["blockers"])
    def test_bad_historical_coverage_fails_reconciliation(self):
        a,b=self.fixture()
        a["2025_26_regular_season_coverage"]["status"]="fail"
        self.assertFalse(decide(a,b)["historical_data_audited"])
if __name__=="__main__":unittest.main()

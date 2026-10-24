import unittest
from scripts.nbl_parameter_screen import screen

class ParameterScreenLeakageTests(unittest.TestCase):
    def event(self,ident,day,hs,aws):
        return {"id":ident,"played_at":day,"home":"Sydney Kings",
                "away":"Perth Wildcats","home_score":hs,"away_score":aws}
    def test_parameter_selection_is_unaffected_by_future_holdout(self):
        warm=[self.event("w","2024-10-01T08:00Z",90,81)]
        valid=[self.event("v","2025-10-01T08:00Z",85,78)]
        future_win=[self.event("h","2026-10-01T08:00Z",94,72)]
        future_loss=[self.event("h","2026-10-01T08:00Z",72,94)]
        a=screen([("2024-25",warm),("2025-26",valid),("2026-27",future_win)])
        b=screen([("2024-25",warm),("2025-26",valid),("2026-27",future_loss)])
        self.assertEqual(a["best_validation_parameters"],b["best_validation_parameters"])
        self.assertTrue(a["heldout_not_used_for_selection"])
        self.assertFalse(a["production_approved"])
        self.assertNotEqual(a["selected_holdout"],b["selected_holdout"])
if __name__=="__main__":unittest.main()

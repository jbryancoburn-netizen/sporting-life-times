"""No-network Monte Carlo tests. Synthetic toy simulations MUST NOT become forecasts."""
import unittest
from scripts.politics_sim_engine import (
    simulate_core,release_gate,run_certified_2026_house_model,
    UncertifiedForecast,audit_file,validate_sigmas
)
class EngineTests(unittest.TestCase):
    def test_fail_closed_without_official_sources(self):
        okay,gaps=release_gate({},{"house_forecast_ready":False})
        self.assertFalse(okay)
        self.assertIn("official_2026_ballot_candidates_verified",gaps)
        with self.assertRaises(UncertifiedForecast):
            run_certified_2026_house_model(
                [{"race_id":"FL-01","state":"FL","dem_margin_estimate_pp":0}],
                {"national":4,"state":3,"race":4},{},{"house_forecast_ready":False})
    def test_reproducible_simulation_seat_distribution(self):
        toy=[{"race_id":f"FL-{i:02d}","state":"FL",
              "dem_margin_estimate_pp":(-1 if i%2 else 1)} for i in range(1,13)]
        kwargs=dict(error={"national":2,"state":3,"race":4},draws=300,seed=42,control_threshold=7)
        a=simulate_core(toy,**kwargs)
        b=simulate_core(toy,**kwargs)
        self.assertEqual(a,b)
        self.assertTrue(a["national_state_race_correlated"])
        self.assertEqual(a["race_count"],12)
        self.assertEqual(len(a["simulated_dem_seat_totals"]),300)
        self.assertTrue(0<a["control_probability"]<1)
        self.assertLessEqual(a["dem_seat_p05"],a["dem_seat_p95"])
    def test_shared_national_error_creates_correlated_outcomes(self):
        races=[{"race_id":"FL-01","state":"FL","dem_margin_estimate_pp":0},
               {"race_id":"CA-01","state":"CA","dem_margin_estimate_pp":0}]
        correlated=simulate_core(races,{"national":10,"state":0,"race":0},draws=1000,seed=2)
        seats=correlated["simulated_dem_seat_totals"]
        self.assertTrue(all(seat in (0,2) for seat in seats))
        self.assertEqual(correlated["win_probabilities"]["FL-01"],correlated["win_probabilities"]["CA-01"])
        independent=simulate_core(races,{"national":0,"state":0,"race":10},draws=1000,seed=2)
        self.assertIn(1,independent["simulated_dem_seat_totals"])
    def test_duplicate_races_and_unvalidated_sigmas_fail(self):
        toy=[{"race_id":"FL-01","state":"FL","dem_margin_estimate_pp":0}]
        with self.assertRaises(ValueError):
            simulate_core(toy+toy,{"national":3,"state":2,"race":4})
        with self.assertRaises(ValueError):
            validate_sigmas({"national":0,"state":0,"race":0})
        with self.assertRaises(ValueError):
            simulate_core(toy,{"national":1,"state":1,"race":1},draws=2)
    def test_no_synthetic_results_in_public_audit(self):
        audit=audit_file({"house_forecast_ready":False})
        self.assertEqual(audit["certified_2026_probability_count"],0)
        self.assertFalse(audit["forecast_2026_certified"])
        self.assertEqual(audit["published_real_seat_simulations"],0)
        self.assertNotIn("win_probabilities",audit)
        self.assertIsNone(audit["national_sigma_pp"])
if __name__=="__main__":unittest.main()

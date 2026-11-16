#!/usr/bin/env python3
"""Sanity checks for retrospective RETRO challenger (no live mutation)."""
import math
import unittest
import experiment_soccer_conference_draw_venue as model

class ExperimentContracts(unittest.TestCase):
    def test_three_way_probabilities_sum_to_one(self):
        for p in (.01,.35,.5,.9,.99):
            for gap in (-400.,0.,400.):
                vals=model.probabilities(p,gap,.28,650.)
                self.assertAlmostEqual(sum(vals),1.)
                self.assertTrue(all(0.<=v<=1. for v in vals))
    def test_draw_decreases_with_mismatch(self):
        self.assertGreater(model.probabilities(.5,0.,.25,650.)[1],
                           model.probabilities(.5,350.,.25,650.)[1])
    def test_fixed_draw_is_constant(self):
        self.assertEqual(model.probabilities(.5,100.,.24,0.)[1],.24)
        self.assertEqual(model.probabilities(.5,800.,.24,0.)[1],.24)
    def test_source_does_not_contain_committee_outcomes(self):
        from pathlib import Path
        source=Path(model.__file__).read_text()
        self.assertNotIn("soccer-2026-selection-archive",source)
        self.assertNotIn("ncaa-selection-projection-2026",source)
    def test_venue_unknown_is_not_labeled_neutral(self):
        # Validate source preserves the distinction between unknown and verified neutral.
        from pathlib import Path
        source=Path(model.__file__).read_text()
        self.assertIn('g.get("neutral_venue") is True',source)
if __name__=="__main__": unittest.main()

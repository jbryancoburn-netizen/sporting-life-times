import copy
import json
import unittest
from pathlib import Path
from audit_ncaam_overhaul_promotion import audit

class OverhaulPromotionAuditTests(unittest.TestCase):
    def setUp(self):
        root=Path("data")
        read=lambda name:json.loads((root/name).read_text())
        self.args=[
            read("ncaam-2026-27-player-quality-overhaul-shadow.json"),
            read("ncaam-2026-27-preseason-roster-informed.json"),
            read("ncaam-preseason-roster-source-provenance.json"),
            read("ncaam-2026-27-player-quality-release-decision.json"),
            read("ncaam-quality-earlyseason-asof-backtest.json"),
            read("ncaam-2026-27-scoring-quality-shadow.json")
        ]

    def test_current_research_not_promoted(self):
        result=audit(*self.args)
        self.assertFalse(result["promotion_approved"])
        self.assertNotIn("STALE_OR_MISMATCHED_PLAYER_QUALITY_CALIBRATION",result["blocking_reasons"])

    def test_stale_candidate_beta_blocks(self):
        args=copy.deepcopy(self.args)
        args[0]["source_quality_beta"]=400
        self.assertIn("STALE_OR_MISMATCHED_PLAYER_QUALITY_CALIBRATION",audit(*args)["blocking_reasons"])

    def test_stale_shadow_beta_blocks(self):
        args=copy.deepcopy(self.args)
        args[5]["source_integrity"]["quality_beta"]=400
        self.assertIn("STALE_OR_MISMATCHED_PLAYER_QUALITY_CALIBRATION",audit(*args)["blocking_reasons"])

    def test_invalid_calibration_status_blocks(self):
        args=copy.deepcopy(self.args)
        args[4]["preseason_release_approved"]=True
        self.assertIn("EARLYSEASON_RESEARCH_CALIBRATION_INVALID",audit(*args)["blocking_reasons"])

if __name__=="__main__":
    unittest.main()

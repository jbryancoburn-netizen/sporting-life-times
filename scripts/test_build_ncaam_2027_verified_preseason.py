#!/usr/bin/env python3
"""Rebuild the published 365-team roster-informed preseason Elo and test release guards."""
import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_ncaam_2027_verified_preseason import build

ROOT=Path(__file__).resolve().parent.parent/"data"
INPUT_NAMES=[
    "ncaam-2026-27-preseason-provisional.json",
    "ncaam-2026-27-team-registry.json",
    "ncaam-2026-27-player-movement-audit.json",
    "ncaam-2026-27-minutes-retention-audit.json",
    "ncaam-2026-27-direct-player-crosswalk.json",
    "ncaam-offseason-transfer-backtest.json"
]
class RosterInformedReleaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inputs=[json.loads((ROOT/x).read_text(encoding="utf-8")) for x in INPUT_NAMES]
        cls.published=json.loads((ROOT/"ncaam-2026-27-preseason-roster-informed.json").read_text(encoding="utf-8"))
    def test_all_365_published_ratings_rebuild_from_sources(self):
        actual=build(*self.inputs)
        self.assertEqual(actual["team_count"],365)
        self.assertEqual(actual["evidence"]["players_with_verified_historical_minutes"],2923)
        self.assertEqual(actual["evidence"]["roster_programs"],364)
        self.assertEqual(actual["evidence"]["fuzzy_id_matches_excluded"],6)
        self.assertEqual(actual["evidence"]["historical_name_match_school_conflicts_excluded"],7)
        self.assertFalse(actual["production_elo_approved"])
        for computed,published in zip(actual["rankings"],self.published["rankings"]):
            self.assertEqual(computed["team_id"],published["team_id"])
            self.assertEqual(computed["rank"],published["rank"])
            self.assertAlmostEqual(computed["elo"],published["elo"],places=4)
            self.assertAlmostEqual(computed["offseason_adjustment"],published["offseason_adjustment"],places=4)
    def test_uncovered_west_florida_preserves_baseline(self):
        actual=build(*self.inputs)
        row=next(x for x in actual["rankings"] if x["team"]=="West Florida")
        self.assertEqual(row["roster_coverage"],"baseline-fallback")
        self.assertEqual(row["elo"],row["base_elo"])
    def test_bad_crosswalk_blob_rejected(self):
        inputs=list(self.inputs)
        inputs[4]=copy.deepcopy(inputs[4])
        inputs[4]["source_blob_sha"]="tampered"
        with self.assertRaisesRegex(ValueError,"crosswalk changed"):
            build(*inputs)
    def test_missing_player_link_rejected(self):
        inputs=list(self.inputs)
        inputs[4]=copy.deepcopy(inputs[4])
        inputs[4]["links"].pop()
        with self.assertRaisesRegex(ValueError,"record count"):
            build(*inputs)
    def test_worse_holdout_rejected(self):
        inputs=list(self.inputs)
        inputs[5]=copy.deepcopy(inputs[5])
        inputs[5]["test_candidate"]["log_loss"]=10.0
        with self.assertRaisesRegex(ValueError,"validation"):
            build(*inputs)
    def test_team_membership_corruption_rejected(self):
        inputs=list(self.inputs)
        inputs[1]=copy.deepcopy(inputs[1])
        inputs[1]["teams"].pop()
        with self.assertRaisesRegex(ValueError,"baseline or complete"):
            build(*inputs)
if __name__=="__main__":unittest.main()

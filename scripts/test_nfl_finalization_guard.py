#!/usr/bin/env python3
"""Tests for automatic NFL final-game reconciliation."""
import unittest
from pathlib import Path
import datetime as dt
from nfl_finalization_guard import compare, verify, overlay_recent_live_finals


def fixture():
    def game(state, a=21, h=17):
        return {"id": "100", "state": state, "away": {"id": "1", "score": a},
                "home": {"id": "2", "score": h}}
    edition = {
        "season": 2026, "coverage": {"finals": 1},
        "games": [game("post")] + [{"id": str(i), "state": "pre"} for i in range(101, 372)],
        "teams": [{"id": str(i), "played": 1 if i in (1, 2) else 0} for i in range(1, 33)],
    }
    live = {"season": 2026, "games": [game("post")]}
    boxes = {"games": {"100": {"players": []}}}
    return edition, live, boxes


class FinalizationTests(unittest.TestCase):
    def test_existing_final(self):
        e, l, b = fixture()
        self.assertEqual(compare(e, l, b), ([], []))
        self.assertEqual(verify(e, l, b), [])

    def test_new_final_triggers_rebuild(self):
        e, l, b = fixture()
        e["games"][0]["state"] = "in"
        self.assertEqual(compare(e, l, b)[0], ["100"])

    def test_corrected_final_triggers_rebuild(self):
        e, l, b = fixture()
        l["games"][0]["home"]["score"] = 20
        self.assertEqual(compare(e, l, b)[0], ["100"])

    def test_missing_box_retries(self):
        e, l, b = fixture()
        b["games"].clear()
        self.assertEqual(compare(e, l, b), ([], ["100"]))
        self.assertEqual(verify(e, l, b), ["100"])

    def test_no_in_progress_score_changes_record(self):
        e, l, b = fixture()
        l["games"][0]["state"] = "in"
        l["games"][0]["home"]["score"] = 30
        self.assertEqual(compare(e, l, b), ([], []))

    def test_fresh_scoreboard_final_updates_weekly_ledger(self):
        e, l, _ = fixture()
        now = dt.datetime(2026, 11, 8, 21, 0, tzinfo=dt.timezone.utc)
        l["updated_at"] = now.isoformat()
        e["games"][0]["state"] = "in"
        reconciled = overlay_recent_live_finals(
            {g["id"]: g for g in e["games"]}, l, now)
        self.assertEqual(reconciled["100"]["state"], "post")
        self.assertEqual(reconciled["100"]["away"]["score"], 21)

    def test_stale_snapshot_cannot_override_newer_weekly_score(self):
        e, l, _ = fixture()
        now = dt.datetime(2026, 11, 8, 21, 0, tzinfo=dt.timezone.utc)
        l["updated_at"] = (now - dt.timedelta(hours=2)).isoformat()
        e["games"][0]["state"] = "in"
        reconciled = overlay_recent_live_finals(
            {g["id"]: g for g in e["games"]}, l, now)
        self.assertEqual(reconciled["100"]["state"], "in")

    def test_live_in_progress_game_cannot_finalize(self):
        e, l, _ = fixture()
        now = dt.datetime(2026, 11, 8, 21, 0, tzinfo=dt.timezone.utc)
        l["updated_at"] = now.isoformat()
        l["games"][0]["state"] = "in"
        e["games"][0]["state"] = "pre"
        reconciled = overlay_recent_live_finals(
            {g["id"]: g for g in e["games"]}, l, now)
        self.assertEqual(reconciled["100"]["state"], "pre")

    def test_pages_dispatch_requires_published_new_final(self):
        workflow = (Path(__file__).resolve().parents[1] /
                    ".github/workflows/nfl-gameday-live.yml").read_text()
        self.assertIn("actions: write", workflow)
        self.assertIn("id: reconcile", workflow)
        self.assertIn("id: publish", workflow)
        self.assertIn("steps.reconcile.outputs.finalization_required == 'true' && steps.publish.outputs.published == 'true'", workflow)
        self.assertIn("workflow_id: 'publish-newspaper.yml'", workflow)


if __name__ == "__main__":
    unittest.main()

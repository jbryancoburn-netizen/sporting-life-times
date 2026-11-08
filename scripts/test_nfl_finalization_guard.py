#!/usr/bin/env python3
"""Tests for automatic NFL final-game reconciliation."""
import unittest
from nfl_finalization_guard import compare, verify


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


if __name__ == "__main__":
    unittest.main()

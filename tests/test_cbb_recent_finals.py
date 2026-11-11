#!/usr/bin/env python3
"""Completed NCAA games must be audited immediately, not after a tipoff-age grace period."""
import io
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from audit_cbb_final_pipeline import source_finals


class RecentFinalAuditTests(unittest.TestCase):
    def event(self, completed=True, season=2027):
        return {
            "id": "401999999",
            "date": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
            "season": {"year": season},
            "status": {"type": {"completed": completed}},
            "competitions": [{
                "competitors": [
                    {"homeAway": "home", "team": {"id": "101"}, "score": "78"},
                    {"homeAway": "away", "team": {"id": "102"}, "score": "72"},
                ]
            }],
        }

    def check(self, gender, event, known=("101", "102")):
        payload = json.dumps({"events": [event]}).encode("utf-8")
        with patch("audit_cbb_final_pipeline.urllib.request.urlopen",
                   side_effect=lambda *args, **kwargs: io.BytesIO(payload)):
            return source_finals(gender, set(known))

    def test_recent_mens_final_is_audited_without_waiting(self):
        games, warnings = self.check("men", self.event())
        self.assertFalse(warnings)
        self.assertIn("401999999", [g["id"] for g in games])

    def test_recent_womens_final_is_audited_without_waiting(self):
        games, warnings = self.check("women", self.event())
        self.assertFalse(warnings)
        self.assertIn("401999999", [g["id"] for g in games])

    def test_live_games_are_not_marked_final(self):
        games, warnings = self.check("men", self.event(completed=False))
        self.assertFalse(games)
        self.assertFalse(warnings)

    def test_unknown_division_one_team_is_excluded(self):
        games, warnings = self.check("women", self.event(), known=("101",))
        self.assertFalse(games)
        self.assertFalse(warnings)


if __name__ == "__main__":
    unittest.main()

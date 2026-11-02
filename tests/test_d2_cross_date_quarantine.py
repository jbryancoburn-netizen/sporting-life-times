"""Exact official-versus-NCAA cross-midnight fixture quarantine regression."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from scripts.build_d2_basketball import apply_official_school_grid_snapshots

URL = "https://smusaints.com/sports/mens-basketball/schedule/2026-27?grid=true"


def evidence():
    return {
        "schema": 1,
        "season": "2026-27",
        "schools": [{
            "gender": "men",
            "owner_id": "saint-martin-s",
            "source_url": URL,
            "fixtures": [{
                "date": "2026-12-19",
                "role": "home",
                "opponent": "Hawaii Pacific",
                "start_time": "10:00 PM ET",
            }],
        }],
        "live_school_sources": [],
        "cross_date_quarantines": [{
            "gender": "men",
            "owner_id": "saint-martin-s",
            "opponent": "Hawaii Pacific",
            "official_school_date": "2026-12-19",
            "official_school_url": URL,
            "official_school_time_et": "10:00 PM ET",
            "ncaa_game_id": "6665372",
            "ncaa_game_date": "2026-12-20",
            "ncaa_game_time_et": "12:30 AM ET",
            "reason": "Two source dates disagree; preserve NCAA identity.",
        }],
    }


def fixtures():
    ncaa = {
        "id": "6665372", "date": "2026-12-20",
        "away": "hawaii-pacific", "home": "saint-martin-s",
        "source": "NCAA scoreboard", "source_url": "https://www.ncaa.com/game/6665372",
        "status": "scheduled", "away_score": None, "home_score": None,
        "start_time": "12:30 AM ET",
    }
    grid = {
        "id": "d2schoolgrid-2026-men-saint-martin-s-2026-12-19-hawaii-pacific",
        "date": "2026-12-19",
        "away": "hawaii-pacific", "home": "saint-martin-s",
        "source": "Official university 2026-27 school schedule",
        "source_url": URL,
        "status": "scheduled", "away_score": None, "home_score": None,
        "start_time": "10:00 PM ET",
    }
    return {ncaa["id"]: ncaa, grid["id"]: grid}


class CrossDayDiiConflictTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "official.json"
        self.path.write_text(json.dumps(evidence()))
        self.teams = {
            "saint-martin-s": {"id": "saint-martin-s",
                               "name": "Saint Martin's"},
            "hawaii-pacific": {"id": "hawaii-pacific",
                               "name": "Hawaii Pacific"},
        }

    def apply(self, games):
        return apply_official_school_grid_snapshots(
            "men", games, self.teams, today=dt.date(2026, 11, 2),
            registry_file=self.path, live_sources=False)

    def test_only_synthetic_duplicate_removed_and_ncaa_game_preserved(self):
        games = fixtures()
        original = dict(games["6665372"])
        count = self.apply(games)
        self.assertEqual(count["cross_date_quarantined_source_rows"], 1)
        self.assertEqual(count["cross_date_duplicate_games_removed"], 1)
        self.assertEqual(count["created"], 0)
        self.assertEqual(len(games), 1)
        self.assertEqual(games["6665372"], original)
        # Repeated publication is idempotent, preserving canonical NCAA ID.
        again = self.apply(games)
        self.assertEqual(again["cross_date_duplicate_games_removed"], 0)
        self.assertEqual(again["created"], 0)
        self.assertEqual(len(games), 1)

    def test_final_result_is_never_deleted_even_if_cross_day_conflict(self):
        games = fixtures()
        synthetic = games[next(k for k in games if k.startswith("d2schoolgrid-"))]
        synthetic["status"] = "final"
        synthetic["away_score"] = 66
        synthetic["home_score"] = 75
        count = self.apply(games)
        self.assertEqual(count["cross_date_duplicate_games_removed"], 0)
        self.assertEqual(len(games), 2)
        self.assertEqual(synthetic["status"], "final")
        self.assertEqual(games["6665372"]["id"], "6665372")

    def test_absent_ncaa_id_cannot_erase_unverified_date_without_crosscheck(self):
        games = fixtures()
        ncaa = games.pop("6665372")
        ncaa["id"] = "different-ncaa-id"
        games[ncaa["id"]] = ncaa
        count = self.apply(games)
        self.assertEqual(count["cross_date_quarantined_source_rows"], 0)
        self.assertEqual(count["cross_date_duplicate_games_removed"], 0)
        self.assertEqual(len(games), 2)

    def test_two_day_gap_does_not_auto_quarantine_matchup(self):
        games = fixtures()
        games["6665372"]["date"] = "2026-12-21"
        count = self.apply(games)
        self.assertEqual(count["cross_date_quarantined_source_rows"], 0)
        self.assertEqual(count["cross_date_duplicate_games_removed"], 0)
        self.assertEqual(len(games), 2)


if __name__ == "__main__":
    unittest.main()

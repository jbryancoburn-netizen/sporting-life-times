"""Unit contract for incremental NCAA college soccer Elo newspaper mirror."""
import copy
import datetime as dt
import hashlib
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import update_college_soccer_elo as c


def fixture_baseline():
    def team(gender, div, slug):
        return {"gender": gender, "division": div, "team_id": slug, "team": slug.upper(),
                "rank": 1, "elo": 1500.0, "gp": 0, "w": 0, "l": 0, "d": 0,
                "gf": 0, "ga": 0, "gd": 0, "record": "0-0-0", "provisional": True}
    return {
        "status": "provisional", "as_of": "2026-10-22",
        "cohorts": {
            f"{gender}-d{div}": [team(gender, div, f"{gender}-d{div}-a"),
                                team(gender, div, f"{gender}-d{div}-b")]
            for gender in ("men", "women") for div in (1, 2, 3)
        },
        "warnings": [],
    }


def game(gid="men-100", date="2026-10-23", gender="men",
         home="men-d1-a", away="men-d1-b", hg=2, ag=0):
    return {"match_id": gid, "date": date, "gender": gender,
            "home_team": home, "away_team": away,
            "home_goals": hg, "away_goals": ag,
            "source_game": "https://www.ncaa.com/game/100"}


def ledger(b):
    return {"schema_version": 1, "baseline_as_of": b["as_of"],
            "baseline_sha256": c.canonical_digest(b), "results": []}


def original_scoreboard(day="10/23/2026", status="final", hg="2", ag="0", gid="100"):
    return {"game": {"gameState": status, "gameID": gid, "startDate": day,
                     "home": {"score": hg, "names": {"seo": "men-d1-a"}},
                     "away": {"score": ag, "names": {"seo": "men-d1-b"}}}}


class TestCollegeSoccerLive(unittest.TestCase):
    def setUp(self):
        self.b = fixture_baseline()
        self.l = ledger(self.b)

    def test_baseline_accepted(self):
        c.validate_baseline(self.b)
        model, a = c.replay(self.b, self.l)
        self.assertEqual(model, self.b)
        self.assertEqual(a["applied_finals"], 0)

    def test_final_ingested_once(self):
        added, model, audit = c.update(self.b, self.l, [game()])
        self.assertEqual(audit["new_games_seen"], 1)
        self.assertEqual(audit["applied_finals"], 1)
        self.assertEqual(model["as_of"], "2026-10-23")
        self.assertEqual(model["cohorts"]["men-d1"][0]["gp"], 1)
        again, model2, audit2 = c.update(self.b, added, [game()])
        self.assertEqual(audit2["new_games_seen"], 0)
        self.assertEqual(model, model2)
        self.assertEqual(len(again["results"]), 1)

    def test_zero_sum_and_records(self):
        _, model, _ = c.update(self.b, self.l, [game()])
        a, b = model["cohorts"]["men-d1"]
        self.assertAlmostEqual(a["elo"]+b["elo"], 3000, 3)
        self.assertEqual(a["record"], "1-0-0")
        self.assertEqual(b["record"], "0-1-0")
        self.assertEqual(a["gd"]+b["gd"], 0)

    def test_draw_and_home_expectation(self):
        _, m, _ = c.update(self.b, self.l, [game(hg=0,ag=0)])
        a, b = m["cohorts"]["men-d1"]
        self.assertEqual(a["record"], "0-0-1")
        self.assertEqual(b["record"], "0-0-1")
        self.assertLess(a["elo"], 1500)
        self.assertGreater(b["elo"], 1500)

    def test_late_result_replay_is_causal_ordered(self):
        first = game("men-201", "2026-10-24", hg=1, ag=0)
        second = game("men-200", "2026-10-23", hg=2, ag=1)
        got, table, _ = c.update(self.b, self.l, [first])
        got, table2, _ = c.update(self.b, got, [second])
        direct, table3, _ = c.update(self.b, self.l, [second, first])
        self.assertEqual(table2, table3)
        self.assertEqual(got, direct)

    def test_score_correction_blocks_publication(self):
        l, _, _ = c.update(self.b, self.l, [game()])
        with self.assertRaisesRegex(ValueError, "FINAL_CORRECTION_REQUIRED"):
            c.update(self.b, l, [game(hg=3)])

    def test_cross_division_excluded_with_evidence(self):
        _, m, a = c.update(self.b, self.l, [game(away="women-d1-a")])
        self.assertEqual(a["excluded_finals"], 1)
        self.assertEqual(a["applied_finals"], 0)
        self.assertEqual(m["cohorts"]["men-d1"][0]["gp"], 0)

    def test_old_game_rejected_as_baseline_overlap(self):
        _, m, a = c.update(self.b, self.l, [game(date="2026-10-22")])
        self.assertEqual(a["new_games_seen"], 0)
        self.assertEqual(m, self.b)

    def test_ledger_tamper_fail_closed(self):
        l = ledger(self.b)
        l["baseline_sha256"] = "0"*64
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            c.replay(self.b, l)

    def test_nonfinal_is_not_ingested(self):
        x = c.normalized_final(original_scoreboard(status="live"), "men", dt.date(2026,10,23))
        self.assertIsNone(x)

    def test_scoreboard_final_zero_score(self):
        x = c.normalized_final(original_scoreboard(hg="0",ag="0"),"men",dt.date(2026,10,23))
        self.assertEqual(x["home_goals"],0)
        self.assertEqual(x["away_goals"],0)

    def test_bad_final_has_no_synthetic_score(self):
        with self.assertRaisesRegex(ValueError, "invalid posted"):
            c.normalized_final(original_scoreboard(hg="",ag=""),"men",dt.date(2026,10,23))

    def test_api_cross_feed_id_dedup(self):
        def provider(url):
            return {"games": [original_scoreboard()]} if "soccer-men/" in url else {"games":[]}
        results, audit = c.fetch_finals(dt.date(2026,10,23),dt.date(2026,10,23),provider)
        self.assertEqual(len(results),1)
        self.assertEqual(audit["scoreboards"],6)

    def test_conflicting_game_ids_abort(self):
        def provider(url):
            return {"games": [original_scoreboard(hg="3" if "/d2/" in url else "2")]} if "soccer-men/" in url else {"games":[]}
        with self.assertRaisesRegex(ValueError,"conflicting"):
            c.fetch_finals(dt.date(2026,10,23),dt.date(2026,10,23),provider)

    def test_source_failure_aborts_without_publication(self):
        def broken(url):
            raise OSError("source unavailable")
        with self.assertRaisesRegex(OSError, "source unavailable"):
            c.fetch_finals(dt.date(2026,10,23),dt.date(2026,10,23),broken)


if __name__ == "__main__":
    unittest.main()

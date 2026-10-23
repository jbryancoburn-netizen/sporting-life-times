#!/usr/bin/env python3
"""Deterministic, no-network NCAA men's D1 Elo contract tests."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from ncaam_elo import compute,load_games,probability,project,validate_teams,MODEL

TEAMS={"teams":[{"id":"indiana","name":"Indiana","division":"D1"},
                {"id":"purdue","name":"Purdue","division":"D1"},
                {"id":"duke","name":"Duke","division":"D1"}]}
FIELDS=["game_id","date","home_id","away_id","home_score","away_score","site","status","source_url","provider","overtime"]
def row(gid="g1",status="Final",site="home"):
    return dict(game_id=gid,date="2025-11-04",home_id="indiana",away_id="purdue",
                home_score="79",away_score="70",site=site,status=status,
                source_url="https://ncaa.com/example",provider="ncaa",overtime="false")

class NightlyReplayTest(unittest.TestCase):
    def test_future_dated_score_is_excluded(self):
        from update_ncaam_2027 import calculate
        pre={"rankings":[{"team_id":f"ncaa:{i}","elo":1500.0} for i in range(350)]}
        old={"teams":[{"id":f"ncaa:{i}","name":f"Team {i}"} for i in range(350)]}
        current=[{"id":str(i),"team":f"Team {i}","conference":"Test"} for i in range(350)]
        games=[{"contest_id":"future-fixture","game_date":"11/15/2099",
                "home":"Team 0","away":"Team 1","home_score":"88","away_score":"70"}]
        result=calculate(pre,old,current,games)
        self.assertEqual(result["games_played"],0)
        self.assertEqual(result["excluded_examples"][0]["reason"],"future-dated result")

    def test_game_predictions_and_zero_sum(self):
        from update_ncaam_2027 import calculate
        pre={"rankings":[{"team_id":"indiana","elo":1600.0},
                         {"team_id":"purdue","elo":1500.0}]}
        old={"teams":[{"id":"indiana","name":"Indiana"},{"id":"purdue","name":"Purdue"}]}
        # Nightly replay requires full current D-I membership; create synthetic
        # complete registry with 350 uniquely named programs.
        for i in range(348):
            ident=f"synthetic-{i}"
            old["teams"].append({"id":ident,"name":ident})
            pre["rankings"].append({"team_id":ident,"elo":1500.0})
        current=[{"id":str(i+1),"team":t["name"],"conference":"test"} for i,t in enumerate(old["teams"])]
        game=[{"contest_id":"fixture-1","game_date":"11/01/2026",
               "home":"Indiana","away":"Purdue","home_score":"80","away_score":"70"}]
        result=calculate(pre,old,current,game)
        self.assertEqual(result["games_played"],1)
        event=result["events"][0]
        self.assertGreater(event["home_win_probability"],0.5)
        self.assertAlmostEqual(event["home_elo_after"]-event["home_elo_before"],
                               event["home_change"],places=5)
        self.assertAlmostEqual(event["away_elo_before"]-event["away_elo_after"],
                               event["home_change"],places=5)
        self.assertAlmostEqual(sum(x["elo"] for x in result["rankings"]),
                               sum(x["elo"] for x in pre["rankings"]),places=2)

class EloTest(unittest.TestCase):
    def setUp(self):self.teams=validate_teams(TEAMS)
    def file(self,rows):
        tmp=tempfile.TemporaryDirectory()
        path=Path(tmp.name)/"games.csv"
        with path.open("w",newline="") as handle:
            w=csv.DictWriter(handle,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
        self.addCleanup(tmp.cleanup)
        return path
    def test_equal_elo_home_and_neutral(self):
        self.assertGreater(probability(1500,1500),0.5)
        self.assertAlmostEqual(probability(1500,1500,True),0.5)
    def test_final_is_zero_sum_and_replay_deterministic(self):
        games=load_games(self.file([row()]),self.teams)
        a=compute(self.teams,games,"2025-26")
        b=compute(self.teams,games,"2025-26")
        self.assertEqual(a["ratings"],b["ratings"])
        self.assertAlmostEqual(sum(a["ratings"].values()),4500,places=3)
        self.assertGreater(a["ratings"]["indiana"],1500)
        self.assertEqual(a["ratings"]["duke"],1500)
        self.assertEqual(a["ledger"][0]["id"],"g1")
        self.assertEqual(a["rankings"][0]["team_id"],"indiana")
        self.assertEqual(a["status"],"provisional")
    def test_no_scheduled_results_counted(self):
        games=load_games(self.file([row(status="Scheduled")]),self.teams)
        self.assertEqual(games,[])
    def test_duplicate_ids_rejected(self):
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            load_games(self.file([row(),row()]),self.teams)
    def test_unknown_team_rejected(self):
        r=row();r["away_id"]="unknown"
        with self.assertRaisesRegex(ValueError,"Unknown"):
            load_games(self.file([r]),self.teams)
    def test_no_source_rejected(self):
        r=row();r["source_url"]=""
        with self.assertRaisesRegex(ValueError,"source"):
            load_games(self.file([r]),self.teams)
    def test_season_transition(self):
        first=compute(self.teams,load_games(self.file([row()]),self.teams),"2025-26")
        second=compute(self.teams,[],"2026-27",first)
        self.assertAlmostEqual(second["start"]["indiana"]-1500,(first["ratings"]["indiana"]-1500)*0.65,places=3)
    def test_prediction(self):
        r=compute(self.teams,[],"2026-27")
        p=project(r,"indiana","purdue",neutral=True)
        self.assertAlmostEqual(p["home_win_probability"],0.5)
        self.assertEqual(p["status"],"uncalibrated_estimate")
if __name__=="__main__":unittest.main()

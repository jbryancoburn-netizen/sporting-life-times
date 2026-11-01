#!/usr/bin/env python3
"""Offline NFL season-reset model and integrity checks."""
import importlib.util
import math
import unittest
import re
from pathlib import Path

spec=importlib.util.spec_from_file_location("nfl",Path(__file__).with_name("build_nfl_edition.py"))
nfl=importlib.util.module_from_spec(spec)
spec.loader.exec_module(nfl)

def mk(game_id,away,home,ascore,hscore,date="2026-09-10T23:20:00Z",state="post"):
    return {"id":str(game_id),"date":date,"week":1,"away":{"id":str(away),"name":nfl.META[away][0],"score":ascore},
        "home":{"id":str(home),"name":nfl.META[home][0],"score":hscore},"state":state}

class EloTests(unittest.TestCase):
    def test_nfl_crest_has_exactly_two_bands(self):
        root=Path(__file__).resolve().parents[1]
        css=(root/"nfl-badge-v3.css").read_text(encoding="utf-8")
        javascript=(root/"nfl-edition-v3.js").read_text(encoding="utf-8")
        self.assertIn("background:var(--nfl-primary)!important",css)
        self.assertIn("border:var(--nfl-inner) solid var(--nfl-secondary)!important",css)
        self.assertIn("background:#fff!important",css)
        self.assertIn('class="nfl-badge ',javascript)
        self.assertIn('class="nfl-badge-core"',javascript)
        self.assertNotIn('class="nfl-crest ',javascript)
        self.assertNotIn('class="nfl-two-band ',javascript)
        self.assertNotIn("radial-gradient(",css)
        self.assertIn("content:none!important",css)
        for name in ["nfl.html","nfl-standings.html","nfl-rankings.html","nfl-players.html","nfl-schedule.html","nfl-game-center.html","nfl-team.html","nfl-game.html","nfl-playoffs.html"]:
            with self.subTest(page=name):
                page=(root/name).read_text(encoding="utf-8")
                self.assertIn("nfl-badge-v3.css?v=20261101-2realrings",page)
                self.assertIn("nfl-edition-v3.js?v=20261101-2realrings",page)
                self.assertNotIn('src="nfl-edition.js?',page)

    def test_exact_preseason_reset(self):
        t=nfl.replay([])
        self.assertEqual(len(t),32)
        self.assertTrue(all(x["elo"]==1500.0 for x in t))
        self.assertTrue(all(x["played"]==0 for x in t))

    def test_home_win_replay_and_zero_sum(self):
        games=[mk(1,2,1,17,24),mk(2,3,4,21,14,date="2026-09-11T00:10:00Z")]
        t=nfl.replay(games)
        mapping={x["id"]:x for x in t}
        self.assertGreater(mapping["1"]["elo"],1500)
        self.assertLess(mapping["2"]["elo"],1500)
        self.assertAlmostEqual(sum(x["elo"] for x in t),48000,delta=1)
        self.assertEqual(sum(x["played"] for x in t),4)
        self.assertTrue(all(x["w"]+x["l"]+x["t"]==x["played"] for x in t))
        self.assertAlmostEqual(games[0]["elo"]["home_win_probability"],nfl.probability(1500,1500),places=4)

    def test_tie_counts_and_future_no_mutation(self):
        games=[mk(3,2,1,21,21),mk(4,3,4,None,None,state="pre")]
        t=nfl.replay(games)
        ids={x["id"]:x for x in t}
        self.assertEqual(ids["1"]["t"],1)
        self.assertEqual(ids["2"]["t"],1)
        self.assertEqual(ids["3"]["played"],0)
        self.assertIn("home_win_probability",games[1]["elo"])
        self.assertEqual(sum(x["played"] for x in t),2)

    def test_neutral_field_has_no_hfa(self):
        self.assertAlmostEqual(nfl.probability(1500,1500,0),0.5)
        game=mk(5,2,1,17,24)
        game["neutral_site"]=True
        nfl.replay([game])
        self.assertAlmostEqual(game["elo"]["home_win_probability"],0.5)

    def test_historically_tunable_k_without_legacy_elo(self):
        slow=[mk(7,2,1,17,24)]
        fast=[mk(8,2,1,17,24)]
        ra=nfl.replay(slow,home_advantage=30,k_base=12)
        rb=nfl.replay(fast,home_advantage=30,k_base=36)
        self.assertGreater(next(t for t in rb if t["id"]=="1")["elo"],next(t for t in ra if t["id"]=="1")["elo"])
        self.assertAlmostEqual(sum(t["elo"] for t in rb),48000,delta=1.0)

    def test_team_statistical_leaders_not_restricted_to_league_top_30(self):
        boxes={}
        for i in range(40):
            ident=str(i+1000)
            tid="1" if i>=30 else "2"
            boxes[ident]={"players":[{"id":ident,"name":"Athlete "+str(i),"team_id":tid,
              "category":"passing","stats":{"YDS":(1000-i)*4,"TD":1},
              "headshot":"https://example.invalid/headshot.png"}]}
        league,clubs=nfl.aggregate_leaders(boxes)
        self.assertEqual(len(league["passing"]),30)
        self.assertEqual(len(clubs["1"]["passing"]),5)
        self.assertEqual(clubs["1"]["passing"][0]["name"],"Athlete 30")
        self.assertEqual(len(clubs["2"]["passing"]),5)
        self.assertEqual(clubs["1"]["rushing"],[])

    def test_no_historical_seed(self):
        self.assertEqual(nfl.SEASON,2026)
        self.assertEqual(nfl.probability(1500,1500),1/(1+10**(-55/400)))
        self.assertEqual(len(nfl.META),32)

if __name__=="__main__":unittest.main()

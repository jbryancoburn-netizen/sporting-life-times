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
                self.assertIn("nfl-edition-v3.js?v="+("20261101-nfl-story1" if name=="nfl-game.html" else "20261101-gamev6"),page)
                self.assertNotIn('src="nfl-edition.js?',page)

    def test_generic_sitewide_crest_does_not_add_third_ring(self):
        root=Path(__file__).resolve().parents[1]
        injected=(root/"scripts/inject-team-crests.py").read_text(encoding="utf-8")
        runtime=(root/"shared-team-crests.js").read_text(encoding="utf-8")
        self.assertIn('if re.match(r"nfl(?:[-.]|$)", path.name, re.IGNORECASE):',injected)
        self.assertIn('missing.append(path.name + " must not load shared-team-crests")',injected)
        self.assertIn("if(img.closest('.nfl-badge,.nfl-badge-core'))return;",runtime)
        self.assertIn("if(/^nfl(?:[-.]|$)/i.test(location.pathname.split('/').pop()||''))return;",runtime)

    def test_live_desk_runs_independently_of_elo(self):
        root=Path(__file__).resolve().parents[1]
        script=(root/"scripts/update_nfl_live.py").read_text(encoding="utf-8")
        page=(root/"nfl-edition-v3.js").read_text(encoding="utf-8")
        self.assertIn("if base[\"state\"]==\"post\" and game[\"state\"]!=\"post\"",script)
        self.assertIn('data/nfl-live.json?ts=',page)
        self.assertIn('fetchEspnLive',page)
        self.assertIn('setInterval(refreshLive,45000)',page)
        self.assertIn('nfl-p26-score-grid',page)
        self.assertIn('nfl-p26-player-grid',page)
        self.assertIn('nfl-p26-main-title',page)
        front=(root/"nfl.html").read_text(encoding="utf-8")
        self.assertIn('nfl-front-premium.css',front)
        self.assertNotIn('nfl-live-day.js',front)
        self.assertIn('nfl-mobile-broadcast.css?v=20261101-broadcast4',front)
        self.assertIn('nfl-p26-score-stage',page)
        self.assertIn('nfl-p26-box-team',page)
        self.assertIn('nfl-p26-box-points',page)
        self.assertIn('nfl-p26-box-identity',page)
        self.assertNotIn('nfl-p26-hero-score"',page)
        self.assertIn('nfl-scoreboard-v4.css?v=20261101-scorev4b',front)
        self.assertIn('nfl-matchup-v5.css?v=20261101-sharedv6',front)
        self.assertIn('--nfl-away-color:',page)
        self.assertIn('--nfl-home-color:',page)
        self.assertIn('const pa=paint(a),ph=paint(h)',page)
        css=(root/"nfl-matchup-v5.css").read_text(encoding="utf-8")
        self.assertIn('clip-path:polygon(',css)
        self.assertIn('var(--nfl-box-color',css)
        self.assertIn('var(--nfl-box-alt',css)
        self.assertNotIn('.nfl-badge::before',css)
        self.assertNotIn('.nfl-badge-core::before',css)

        self.assertIn('nfl-p26-period-rail',page)
        self.assertIn('nfl-p26-ticker-game',page)
        self.assertIn('nfl-p26-feature-stats',page)
        self.assertIn('featuredLiveStats',page)
        self.assertNotIn("'LIVE · '+status(g)",page)


    def test_live_game_center_date_filter_and_logo_fallback(self):
        root=Path(__file__).resolve().parents[1]
        live=(root/"nfl-live-day.js").read_text(encoding="utf-8")
        center=(root/"nfl-game-center.html").read_text(encoding="utf-8")
        game=(root/"nfl-game.html").read_text(encoding="utf-8")
        self.assertIn('query.get("date")',live)
        self.assertIn('scoreboard(viewingDate)',live)
        self.assertIn('urlDay(requestDate)',live)
        self.assertIn('etDate(new Date(g.date))===requestDate',live)
        self.assertIn('if(viewingDate!==chosenDate){rerun=true;return;}',live)
        self.assertIn('selectedTeam==="all"||g.away.id===selectedTeam',live)
        self.assertIn('secondary:t.secondary_color||side.secondary',live)
        self.assertIn('const duplicate=root.querySelector(".nfl-slate")',live)
        self.assertIn('const oldNav=root.querySelector(".nfl-day-nav")',live)
        self.assertNotIn('away:{...g.away,color:"#252525",secondary:"#ba9957"}',live)
        self.assertIn("const observer=new MutationObserver",live)
        self.assertIn("observer.observe(root,{childList:true})",live)
        self.assertIn('setInterval(page==="game"?gameDetails:update,25000)',live)
        self.assertIn('nfl-live-day.js?v=20261101-gamev6',center)
        self.assertIn('nfl-live-day.js?v=20261101-nfl-story1',game)


    def test_nfl_individual_game_has_sourced_editorial_story(self):
        root=Path(__file__).resolve().parents[1]
        page=(root/"nfl-edition-v3.js").read_text(encoding="utf-8")
        game=(root/"nfl-game.html").read_text(encoding="utf-8")
        stylesheet=(root/"nfl-matchup-v5.css").read_text(encoding="utf-8")
        live=(root/"nfl-live-day.js").read_text(encoding="utf-8")
        self.assertIn('function featuredMatch(g)',page)
        self.assertIn('function gamePage()',page)
        self.assertIn('featuredMatch(g)',page)
        self.assertIn('nfl-game-live-slot',page)
        self.assertIn('nfl-game-story-v9.css?v=20261101-nfl-story1',game)
        self.assertNotIn('nfl-matchup-v5.css',game)
        self.assertIn(':is([data-page="front"],[data-page="game"])',stylesheet)
        self.assertIn('root.querySelector("#nfl-game-live-slot")',live)
        self.assertIn('function nflFinalStatus(g)',page)
        self.assertIn("'FINAL/OT'",page)
        self.assertIn('"FINAL/OT"',live)
        self.assertIn('Number(g.period)>4',page)
        self.assertIn('setInterval(refreshLive,45000)',page)

    def test_projection_avoids_rounded_ties_with_opponent_defense(self):
        away=nfl.base_team(12);home=nfl.base_team(7)
        away.update({"pf":143,"pa":103,"played":6,"elo":1566.8})
        home.update({"pf":144,"pa":141,"played":7,"elo":1562.9})
        a,h=nfl.projection(away,home,home_advantage=30)
        self.assertEqual((a,h),(21,22))
        self.assertNotEqual(a,h)
        # Preseason equal offense must still designate a projected winner.
        x=nfl.base_team(1);y=nfl.base_team(2)
        self.assertNotEqual(*nfl.projection(x,y,home_advantage=0))

    def test_period_lines_extract_sourced_fourth_quarter_comeback(self):
        # Actual final and verified quarter breakdown used in the Denver gamefile.
        raw={"header":{"competitions":[{"competitors":[
            {"homeAway":"away","linescores":[{"score":7},{"score":10},{"score":7},{"score":0}]},
            {"homeAway":"home","linescores":[{"score":3},{"score":10},{"score":0},{"score":15}]}
        ]}]}}
        periods=nfl.period_lines_from_summary(raw)
        self.assertEqual([x["score"] for x in periods["away"]],[7,10,7,0])
        self.assertEqual([x["score"] for x in periods["home"]],[3,10,0,15])
        self.assertEqual(sum(x["score"] for x in periods["away"]),24)
        self.assertEqual(sum(x["score"] for x in periods["home"]),28)

    def test_period_lines_fallback_uses_reported_scoring_plays(self):
        raw={"header":{"competitions":[{"competitors":[]}]},"scoringPlays":[
            {"period":{"number":1},"clock":{"displayValue":"8:22"},"awayScore":7,"homeScore":0},
            {"period":{"number":2},"clock":{"displayValue":"1:34"},"awayScore":7,"homeScore":10},
            {"period":{"number":4},"clock":{"displayValue":"0:20"},"awayScore":10,"homeScore":17}
        ]}
        periods=nfl.period_lines_from_summary(raw)
        self.assertEqual([x["score"] for x in periods["away"]],[7,0,0,3])
        self.assertEqual([x["score"] for x in periods["home"]],[0,10,0,7])

    def test_gamefile_story_has_no_background_logo_wallpaper(self):
        root=Path(__file__).resolve().parents[1]
        js=(root/"nfl-edition-v3.js").read_text(encoding="utf-8")
        css=(root/"nfl-game-story-v9.css").read_text(encoding="utf-8")
        html=(root/"nfl-game.html").read_text(encoding="utf-8")
        self.assertNotIn("archivalMark(",js)
        self.assertNotIn("--nfl-club-archive",js)
        self.assertIn("scoreForecast(g)",js)
        self.assertIn("function gameStoryData(g)",js)
        self.assertIn("function gameScoringArc(g,story)",js)
        self.assertIn("nfl-story-field-note", (root/"nfl-game-story-v9.css").read_text(encoding="utf-8"))
        self.assertIn("nflGameStatInsight(box,match)", (root/"nfl-live-day.js").read_text(encoding="utf-8"))
        self.assertIn("nfl-story-scoreline",css)
        self.assertIn("nfl-story-arc",css)
        self.assertIn("display:none!important",css)
        self.assertIn("nfl-game-story-v9.css?v=20261101-nfl-story1",html)

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

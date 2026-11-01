"""Offline contracts for official 2026-27 GLIAC men's and women's games."""
import datetime as dt
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import d2_gliac_official as league

ROOT = Path(__file__).resolve().parents[1]


def entry(date, away, home, owner, posted="7:30 PM"):
    return {"date": date, "away": away, "home": home,
            "tipoff_as_posted": posted, "location_as_posted": "Allendale, Mich.",
            "source_team": owner,
            "source_url": "https://gliac.org/schedule.aspx?schedule=2595"}


class GLIACAuthenticSchedules(unittest.TestCase):
    def test_every_gender_has_11_distinct_verified_directory_ids(self):
        for gender in ("men","women"):
            ids = [x[1] for x in league.SCHOOLS[gender].values()]
            self.assertEqual(len(ids),11)
            self.assertEqual(len(set(ids)),11)
            data = json.loads((ROOT/f"data/d2-{gender}-2026-27.json").read_text())
            actual = {t["id"]:t for t in data["teams"]}
            self.assertEqual(sorted(set(ids)-set(actual)),[])
            self.assertTrue(all(not actual[x].get("not_eligible_for_dii_elo") for x in ids))
        self.assertEqual(league.SCHOOLS["men"][2595][1],"grand-valley-state")
        self.assertEqual(league.SCHOOLS["women"][2608][1],"grand-valley-state-university")
        self.assertEqual(league.SCHOOLS["women"][2614][1],"purdue-university-northwest")

    def test_aliases_are_exact_never_cross_gender_or_unknown(self):
        self.assertEqual(league.member_id("at Wayne State University","men"),"wayne-state-mi")
        self.assertEqual(league.member_id("Purdue Northwest","women"),"purdue-university-northwest")
        self.assertEqual(league.member_id("Parkside","men"),"parkside-wisconsin-parkside")
        self.assertIsNone(league.member_id("Northwood","men"))
        self.assertIsNone(league.member_id("vs Eastern Michigan","women"))
        self.assertEqual(league.posted_tipoff("7:30 P.M."),"7:30 PM")
        self.assertEqual(league.posted_tipoff("12:00 A.M."),"12:00 AM")
        self.assertIsNone(league.posted_tipoff("TBA"))
        self.assertIsNone(league.posted_tipoff("W 74-70"))

    def test_parse_exact_four_column_schedule_and_withhold_opposite_gender(self):
        dates=[dt.date(2026,12,3)+dt.timedelta(days=i*2) for i in range(12)]
        rows="".join("<tr><td>"+f"{d.month}/{d.day}/{d.year}"+
                     "</td><td>at Michigan Tech</td><td>7:30 P.M.</td><td>Houghton, Mich.</td></tr>"
                     for d in dates)
        markup=("<h2>2026-27 Grand Valley State Men's Basketball Schedule</h2>"
                "<table><tr><th>Date</th><th>Opponent</th><th>Result</th>"
                "<th>Location</th></tr>"+rows+"</table>")
        games=league.read_calendar(markup,"men",2595)
        self.assertEqual(len(games),12)
        self.assertEqual((games[0]["away"],games[0]["home"]),
                         ("grand-valley-state","michigan-tech"))
        self.assertEqual(games[0]["tipoff_as_posted"],"7:30 PM")
        with self.assertRaises(ValueError):
            league.read_calendar(markup.replace("Men's Basketball","Women's Basketball"),"men",2595)
        with self.assertRaises(ValueError):
            league.read_calendar(markup.replace("2026-27","2025-26"),"men",2595)
        with self.assertRaises(ValueError):
            league.read_calendar(markup.replace("Grand Valley State","Northern Michigan"),"men",2595)

    def test_opposing_sources_publish_one_game_not_two_with_no_fake_et(self):
        away,home="grand-valley-state","michigan-tech"
        date="2027-01-07"
        a=entry(date,away,home,away)
        b={**entry(date,away,home,home),
           "source_url":"https://gliac.org/schedule.aspx?schedule=2598"}
        games={}
        result=league.reconcile({away:[a],home:[b]},games,{away:{},home:{}},dt.date(2026,11,1))
        self.assertEqual(result["two_school_matchups"],1)
        self.assertEqual(result["new_games"],1)
        self.assertEqual(len(games),1)
        game=next(iter(games.values()))
        self.assertEqual(game["tipoff_as_posted"],"7:30 PM")
        self.assertNotIn("start_time",game,"no unlabeled time may be called ET")
        self.assertEqual(game["posted_tipoff_timezone"],"not established by GLIAC source")
        self.assertNotIn("venue",game)
        self.assertNotIn("network",game)
        self.assertNotIn("stream_url",game)
        self.assertEqual(len(game["official_schedule_sources"]),2)

    def test_identity_disputes_neutrality_or_unverified_final_are_not_upgraded(self):
        a,b="davenport","ferris-state"
        date="2027-01-07"
        x=entry(date,a,b,a)
        y=entry(date,b,a,b)
        games={}
        result=league.reconcile({a:[x],b:[y]},games,{a:{},b:{}},dt.date(2026,11,1))
        self.assertFalse(games)
        self.assertEqual(result["two_school_matchups"],0)
        game={"id":"original-ncaa-id","date":date,"away":a,"home":b,
              "status":"final","away_score":74,"home_score":72,
              "verified":False,"elo_eligible":True}
        before=dict(game)
        games={game["id"]:game}
        y=entry(date,a,b,b)
        result=league.reconcile({a:[x],b:[y]},games,{a:{},b:{}},dt.date(2026,11,1))
        self.assertEqual(result["existing_enriched"],1)
        self.assertEqual(game["away_score"],before["away_score"])
        self.assertEqual(game["home_score"],before["home_score"])
        self.assertFalse(game["verified"])
        self.assertEqual(game["id"],"original-ncaa-id")
        self.assertTrue(game["fixture_verified"])

    def test_conflicting_plain_clocks_are_visible_but_not_assumed_et(self):
        a,b="davenport","ferris-state"
        date="2027-01-07"
        first=entry(date,a,b,a,"7:30 PM")
        second=entry(date,a,b,b,"6:30 PM")
        games={}
        result=league.reconcile({a:[first],b:[second]},games,{a:{},b:{}},dt.date(2026,11,1))
        self.assertEqual(result["time_disagreements"],1)
        g=next(iter(games.values()))
        self.assertNotIn("start_time",g)
        self.assertNotIn("tipoff_as_posted",g)

    def test_withhold_when_most_official_schedules_are_down(self):
        teams={x[1]:{} for x in league.SCHOOLS["women"].values()}
        with patch.object(league,"get_html",side_effect=OSError("source temporarily unavailable")):
            r=league.enrich_gliac("women",{},teams,dt.date(2026,11,1))
        self.assertIn("withheld",r["status"])
        self.assertEqual(r["two_school_matchups"],0)


if __name__=="__main__":
    unittest.main()

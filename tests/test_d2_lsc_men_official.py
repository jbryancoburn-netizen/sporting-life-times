"""Offline 2026-27 LSC men's schedule verification and safe game recovery."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_lsc_men_official import CANDIDATES, SCHOOLS, BASE, parse, et_time, enrich_lsc_men, school

SOURCES={4697:"angelo",4698:"cameron",4699:"dbu",4701:"sulross",
         4702:"tamiu",4703:"wnm",4704:"lubbock",4705:"midwestern",
         4706:"tamuk",4707:"uttyler",4708:"oc",4709:"utpb",
         4710:"utd",4711:"stmarys",4712:"stedwards",4713:"enm",4714:"wtam"}

def grid(owner, rival="DBU", home=False, sex="Men's", day_from=1):
    name=SCHOOLS[owner][0]
    opponent=("" if home else "at ")+rival
    dates=range(day_from,day_from+13)
    rows="".join(
        f"<tr><td>12/{i}/2026</td><td>7 p.m.</td><td>*</td>"
        f"<td>{opponent}</td><td>Official school gym</td><td>7 p.m.</td></tr>"
        for i in dates)
    return (f"<html><head><title>Lone Star Conference</title></head><body>"
            f"<h2>2026-27 {name} {sex} Basketball Schedule (0-0)</h2>"
            "<table><thead><tr><th>Date</th><th>Time (CT)</th>"
            "<th>LSC</th><th>Opponent</th><th>Location</th><th>Result</th>"
            "</tr></thead><tbody>"+rows+"</tbody></table></body></html>")

class LSCVerifiedTests(unittest.TestCase):
    def test_real_2026_27_school_id_range_is_validated_not_guessed(self):
        self.assertEqual(len(SOURCES),17)
        self.assertEqual(len(set(SOURCES.values())),17)
        self.assertTrue(set(SOURCES).issubset(CANDIDATES))
        self.assertEqual(len(CANDIDATES),18)
        self.assertEqual(school("Dallas Baptist University"),"dbu")
        self.assertEqual(school("UT Permian Basin"),"utpb")
        self.assertEqual(school("Texas A&M-Kingsville"),"tamuk")
        self.assertIsNone(school("Texas Wesleyan University"))
        self.assertIsNone(school("Texas A&M Texarkana"))
    def test_parse_genuine_title_and_table_positions(self):
        owner,rows,rejected=parse(grid("angelo"),4697)
        self.assertEqual(owner,"angelo")
        self.assertEqual(len(rows),13)
        self.assertEqual(rows[0][1:4],("angelo","dbu","angelo"))
        self.assertEqual(rows[0][4],"8:00 PM ET")
        self.assertEqual(rejected,0)
    def test_wrong_source_season_gender_or_opponent_are_not_games(self):
        with self.assertRaises(ValueError):
            parse(grid("angelo",sex="Women's"),4697)
        with self.assertRaises(ValueError):
            parse(grid("angelo").replace("2026-27","2025-26"),4697)
        with self.assertRaises(ValueError):
            parse(grid("angelo").replace("at DBU","at NoSuchSchool"),4697)
        with self.assertRaises(ValueError):
            parse(grid("angelo"),9000)
    def test_explicit_ct_time_and_dst(self):
        self.assertEqual(et_time("2026-12-15","7 p.m."),"8:00 PM ET")
        self.assertEqual(et_time("2027-02-15","7:30 p.m."),"8:30 PM ET")
        self.assertIsNone(et_time("2026-12-15","TBA"))
    def test_two_university_reciprocal_only_preserves_ncaa_scores(self):
        teams={key:{"name":values[0],"conference":"LSC","id":key}
               for key,values in SCHOOLS.items()}
        def fetch(url):
            ident=int(url.rsplit("=",1)[1])
            if ident==4700:raise ValueError("not a 2026-27 men's basketball schedule")
            who=SOURCES[ident]
            if who=="dbu":return grid("dbu","Angelo State",home=False)
            if who=="angelo":return grid("angelo","DBU",home=True)
            return grid(who,"DBU",home=False)
        existing={"official-ncaa-final":{
            "id":"official-ncaa-final","date":"2026-12-01",
            "away":"dbu","home":"angelo",
            "status":"final","away_score":70,"home_score":85,
            "verified":True,"neutral":False,
            "source_url":"https://www.ncaa.com/official"}}
        quality=enrich_lsc_men(existing,teams,dt.date(2026,11,1),fetch)
        self.assertEqual(quality["source_school_calendars"],17)
        self.assertEqual(quality["reciprocal_games"],13)
        self.assertEqual(quality["added"],12)
        self.assertEqual(quality["enriched"],1)
        self.assertEqual(len(existing),13)
        self.assertEqual(existing["official-ncaa-final"]["away_score"],70)
        self.assertEqual(existing["official-ncaa-final"]["home_score"],85)
        self.assertEqual(existing["official-ncaa-final"]["id"],"official-ncaa-final")
        self.assertEqual(existing["official-ncaa-final"]["source_url"],"https://www.ncaa.com/official")
        self.assertEqual(existing["official-ncaa-final"]["start_time"],"8:00 PM ET")
        self.assertEqual(len(existing["official-ncaa-final"]["official_schedule_sources"]),2)
        second=enrich_lsc_men(existing,teams,dt.date(2026,11,1),fetch)
        self.assertEqual(second["added"],0)
        self.assertEqual(len(existing),13)
    def test_one_sided_calendar_never_publishes(self):
        teams={key:{"name":values[0],"conference":"LSC","id":key}
               for key,values in SCHOOLS.items()}
        def fetch(url):
            ident=int(url.rsplit("=",1)[1])
            if ident==4700:raise ValueError("invalid candidate")
            who=SOURCES[ident]
            # Every site lists DBU as home; no two schools agree on home/away.
            return grid(who,"Angelo State" if who=="dbu" else "DBU",home=True)
        games={}
        report=enrich_lsc_men(games,teams,dt.date(2026,11,1),fetch)
        self.assertEqual(report["added"],0)
        self.assertEqual(games,{})
if __name__=="__main__":
    unittest.main()

"""Offline verification for reciprocal 2026-27 women's CACC schedules."""
import datetime as dt
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from scripts import d2_cacc_women_official as w


def row(date, away, home, owner, time="6:00 PM ET"):
    return {"date":date,"away":away,"home":home,"source_team":owner,
            "tipoff":time,"city":"Wilmington, DE",
            "source_url":"https://caccathletics.org/schedule.aspx?schedule=2378"}


class CACCDivisionTwoWomen(unittest.TestCase):
    def test_canonical_schools_have_unique_schedule_ids_and_institution_names(self):
        self.assertEqual(len(w.SCHOOLS),11)
        self.assertEqual(len(set(x[1] for x in w.SCHOOLS.values())),11)
        self.assertEqual(w.SCHOOLS[2378][1],"wilmington-university-delaware")
        self.assertEqual(w.SCHOOLS[2395][1],"thomas-jefferson-university")
        self.assertEqual(w.ALIASES["university of bridgeport"],"university-of-bridgeport")
        self.assertNotIn("monroe university",w.ALIASES)

    def test_2026_27_womens_registry_matches_actual_published_team_ids(self):
        # Silent identity mismatches must not make a supposedly successful
        # conference crawl produce zero verified fixtures.
        path=Path(__file__).resolve().parents[1]/"data/d2-women-2026-27.json"
        data=json.loads(path.read_text())
        ids={x["id"] for x in data["teams"]}
        missing=[ident for _,ident in w.SCHOOLS.values() if ident not in ids]
        self.assertEqual(missing,[], "CACC women's calendar IDs disagree with the published NCAA school directory")

    def test_2026_27_womens_calendar_parse_and_eastern_tipoff(self):
        # Sample fixture matrix reproduces Sidearm's actual six-column
        # date/time/opponent/location/result/notes format.
        dates=[dt.date(2026,12,2)+dt.timedelta(days=2*i) for i in range(16)]
        table="".join(
            "<tr><td>"+f"{day.month}/{day.day}/{day.year}"+"</td>"
            "<td>6:00 P.M.</td><td>at Goldey-Beacom College</td>"
            "<td>Wilmington, DE</td><td>6:00 P.M.</td><td></td></tr>"
            for day in dates)
        html=("<h2>2026-27 Wilmington Women's Basketball Schedule</h2>"
              "<table><tr><th>Date</th><th>Time</th><th>Opponent</th>"
              "<th>Location</th><th>Result</th><th>Notes</th></tr>"
              +table+"</table>")
        found=w.parse_women_calendar(html,"wilmington-university-delaware",2378)
        self.assertEqual(len(found),16)
        self.assertEqual(found[0]["home"],"goldey-beacom-college")
        self.assertEqual(found[0]["away"],"wilmington-university-delaware")
        self.assertEqual(found[0]["tipoff"],"6:00 PM ET")
        with self.assertRaises(ValueError):
            w.parse_women_calendar(html.replace("Women's","Men's"),
                                   "wilmington-university-delaware",2378)

    def test_two_independent_members_verify_future_fixture_not_broadcast(self):
        a="wilmington-university-delaware";b="goldey-beacom-college"
        today=dt.date(2026,11,1)
        first=row("2026-12-02",a,b,a)
        second=row("2026-12-02",a,b,b)
        second["source_url"]="https://caccathletics.org/schedule.aspx?schedule=2390"
        games={}; teams={a:{},b:{}}
        q=w.reconcile_women_cacc({a:[first],b:[second]},games,teams,today)
        self.assertEqual(q["two_school_matches"],1)
        self.assertEqual(q["games_added"],1)
        self.assertEqual(q["time_conflicts"],0)
        game=next(iter(games.values()))
        self.assertEqual((game["away"],game["home"]),(a,b))
        self.assertEqual(game["start_time"],"6:00 PM ET")
        self.assertTrue(game["fixture_verified"])
        self.assertNotIn("venue",game)
        self.assertNotIn("network",game)
        self.assertEqual(len(game["conference_schedule_sources"]),2)

    def test_one_sided_and_conflicting_home_away_are_not_fabricated(self):
        a="wilmington-university-delaware";b="goldey-beacom-college"
        game=row("2026-12-02",a,b,a)
        q=w.reconcile_women_cacc({a:[game]}, {},{a:{},b:{}},dt.date(2026,11,1))
        self.assertEqual(q["two_school_matches"],0)
        self.assertEqual(q["single_school_only"],1)
        bad=row("2026-12-02",b,a,b)
        games={}
        q=w.reconcile_women_cacc({a:[game],b:[bad]},games,{a:{},b:{}},dt.date(2026,11,1))
        self.assertEqual(q["two_school_matches"],0)
        self.assertEqual(len(games),0)

    def test_existing_final_remains_unchanged_and_cannot_gain_verified_score(self):
        a="wilmington-university-delaware";b="goldey-beacom-college"
        game={"id":"ncaa-preserved","date":"2026-12-02","away":a,"home":b,
              "status":"final","away_score":76,"home_score":72,"verified":False,
              "elo_eligible":True}
        games={game["id"]:game}
        first=row(game["date"],a,b,a)
        second=row(game["date"],a,b,b)
        q=w.reconcile_women_cacc({a:[first],b:[second]},games,{a:{},b:{}},
                                 dt.date(2026,11,1))
        self.assertEqual(q["games_enriched"],1)
        self.assertEqual(len(games),1)
        self.assertFalse(game["verified"],"schedule must NOT certify final result")
        self.assertTrue(game["fixture_verified"])
        self.assertEqual(game["away_score"],76)
        self.assertEqual(game["home_score"],72)
        self.assertEqual(game["id"],"ncaa-preserved")

    def test_early_source_missing_produces_partial_not_fictional_results(self):
        with patch.object(w,"read_page",side_effect=ConnectionError("source unavailable")):
            q=w.enrich_cacc_women({}, {name:{} for _,name in w.SCHOOLS.values()},
                                  dt.date(2026,11,1))
        self.assertIn("withheld",q["status"])
        self.assertEqual(q["two_school_matches"],0)


if __name__=="__main__":
    unittest.main()

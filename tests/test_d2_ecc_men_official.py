"""Offline ECC source verification, reciprocal school games and NCAA final safety."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_ecc_men_official import SCHOOLS, CANDIDATES, BASE, parse, school, enrich_ecc_men
SOURCES={2679:"daemen",2680:"udc",2681:"dyouville",2684:"mercy",
         2686:"molloy",2687:"queens",2688:"roberts",2692:"stac",2694:"staten"}
def grid(owner,opponent="Mercy",sex="Men's",home=False):
    name=SCHOOLS[owner][0]
    opponent=("" if home else "at ")+opponent
    rows="".join(f"<tr><td>1/{day}/2027</td><td>{opponent}</td>"
                 "<td></td><td>7:00 P.M.</td></tr>" for day in range(7,19))
    return (f"<html><head><title>2026-27 {name} {sex} Basketball - "
            "Schedule - East Coast Conference</title></head><body>"
            "<table><thead><tr><th>Date</th><th>Opponent</th>"
            "<th>Status</th><th>Result</th></tr></thead><tbody>"+rows+
            "</tbody></table></body></html>")
class ECCSchoolRecoveryTests(unittest.TestCase):
    def test_nine_school_directory_with_active_programs_not_future_members(self):
        self.assertEqual(len(SCHOOLS),9)
        self.assertEqual(school("Roberts Wesleyan University"),"roberts")
        self.assertEqual(school("District of Columbia"),"udc")
        self.assertEqual(school("D'Youville"),"dyouville")
        self.assertEqual(school("Queens (N.Y.)"),"queens")
        self.assertIsNone(school("Monroe University"))
    def test_actual_school_heading_date_and_direction(self):
        owner,rows,invalid=parse(grid("roberts","Mercy"),2688)
        self.assertEqual(owner,"roberts")
        self.assertEqual(len(rows),12)
        self.assertEqual(rows[0][1:4],("roberts","mercy","roberts"))
        self.assertEqual(invalid,0)
    def test_wrong_season_gender_neutral_and_unidentified_opponents_quarantined(self):
        for page in (grid("roberts",sex="Women's"),
                     grid("roberts").replace("2026-27","2025-26"),
                     grid("roberts","vs. Mercy"),
                     grid("roberts","Not A Real Opponent")):
            with self.assertRaises(ValueError):parse(page,2688)
    def test_two_witnesses_one_game_and_preserved_past_scores(self):
        teams={key:{"name":aliases[0],"conference":"ECC","id":key}
               for key,aliases in SCHOOLS.items()}
        def pages(url):
            sid=int(url.rsplit("=",1)[1])
            if sid not in SOURCES:raise ValueError("Wrong sport or gender source")
            owner=SOURCES[sid]
            if owner=="mercy":return grid("mercy","Roberts Wesleyan",home=True)
            if owner=="roberts":return grid("roberts","Mercy",home=False)
            return grid(owner,"Mercy",home=False)
        # Mercy and Roberts are reciprocal on 12 dates, eight others are not.
        games={"ncaa-101":{"id":"ncaa-101","date":"2027-01-07",
            "away":"roberts","home":"mercy","status":"final",
            "away_score":55,"home_score":61,"neutral":False,
            "source_url":"https://www.ncaa.com/official"}}
        result=enrich_ecc_men(games,teams,dt.date(2026,11,1),pages)
        self.assertEqual(result["source_school_calendars"],9)
        self.assertEqual(result["reciprocal_games"],12)
        self.assertEqual(result["added"],11)
        self.assertEqual(result["enriched"],1)
        self.assertEqual(len(games),12)
        self.assertEqual(games["ncaa-101"]["away_score"],55)
        self.assertEqual(games["ncaa-101"]["home_score"],61)
        self.assertEqual(games["ncaa-101"]["source_url"],"https://www.ncaa.com/official")
        self.assertEqual(len(games["ncaa-101"]["official_schedule_sources"]),2)
        self.assertTrue(all("start_time" not in game for game in games.values()))
        result2=enrich_ecc_men(games,teams,dt.date(2026,11,1),pages)
        self.assertEqual(result2["added"],0)
        self.assertEqual(len(games),12)
    def test_reverse_home_direction_and_one_sided_never_create_game(self):
        teams={key:{"name":aliases[0],"conference":"ECC","id":key}
               for key,aliases in SCHOOLS.items()}
        def pages(url):
            sid=int(url.rsplit("=",1)[1])
            if sid not in SOURCES:raise ValueError("Invalid source")
            key=SOURCES[sid]
            return grid(key,"Roberts Wesleyan" if key=="mercy" else "Mercy",home=True)
        games={}
        result=enrich_ecc_men(games,teams,dt.date(2026,11,1),pages)
        self.assertEqual(result["added"],0)
        self.assertFalse(games)
if __name__=="__main__":
    unittest.main()

"""Offline official 2026-27 SAC university grid fallback proofs."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_sac_official import (BASE, SOURCES, WOMEN_SCHOOL_GRIDS, LABELS,
                             parse_university_grid, enrich_sac)

def grid(owner, rival, role, wrong_gender=False, clock="5:30 PM"):
    university=WOMEN_SCHOOL_GRIDS[owner][1]
    sex="Men's" if wrong_gender else "Women's"
    rows=[]
    for day in range(1,11):
        name=rival if day==1 else "Wingate University"
        rows.append("<tr><td>December "+str(day)+", 2026 (Monday)</td>"
                    "<td>"+clock+"</td><td>"+role+"</td>"
                    "<td>"+name+"</td><td>Campus</td><td></td>"
                    "<td></td><td></td><td></td></tr>")
    return (f"<html><title>2026-27 {sex} Basketball Schedule - {university} Athletics</title>"
            "<table><tr><th>Date</th><th>Time</th><th>At</th><th>Opponent</th>"
            "<th>Location</th><th>TV</th><th>Radio</th><th>Tournament</th><th>Result</th></tr>"
            + "".join(rows) + "</table></html>")

def sac_grid(owner, gender, specific=None):
    word="Women's" if gender=="women" else "Men's"
    rows=[]
    for day in range(1,11):
        opp=specific if day==1 else "at Wingate University"
        rows.append(f"<tr><td>12/{day}/2026</td><td>{opp}</td><td>Campus</td>"
                    "<td>5:30 P.M.</td><td></td><td></td></tr>")
    return (f"<html><title>2026-27 {LABELS[owner][0]} {word} Basketball"
            " - South Atlantic Conference</title>"
            "<table><tr><th>Date</th><th>Opponent</th><th>Location</th><th>Result</th>"
            "<th>Status</th><th>Notes</th></tr>"+''.join(rows)+"</table></html>")

def directory():
    return {k:{"name":v[-1],"conference":"South Atlantic Conference"}
            for k,v in LABELS.items()}

class UniversityCalendarFallback(unittest.TestCase):
    def test_wrong_season_gender_or_brand_refused(self):
        raw=grid("anderson","Coker University","Home")
        self.assertGreaterEqual(len(parse_university_grid(raw,"anderson")[1]),7)
        with self.assertRaises(ValueError):
            parse_university_grid(raw.replace("2026-27","2025-26"),"anderson")
        with self.assertRaises(ValueError):
            parse_university_grid(grid("anderson","Coker University","Home",True),"anderson")
        with self.assertRaises(ValueError):
            parse_university_grid(raw,"newberry")
    def test_neutral_crossdivision_and_exhibition_held(self):
        raw=grid("anderson","Coker University","Neutral")
        with self.assertRaises(ValueError):
            parse_university_grid(raw,"anderson")
        raw=grid("anderson","UT-Chattanooga (Exhibition)","Home")
        parsed=parse_university_grid(raw,"anderson")
        self.assertFalse(any(x[0]=="2026-12-01" for x in parsed[1]))
    def test_recover_two_official_school_pages_and_preserve_ncaa_final(self):
        # All 12 conference sources are unavailable, but two verified
        # university athletic grids independently corroborate a fixture.
        sites={WOMEN_SCHOOL_GRIDS["anderson"][0]:
                   grid("anderson","Lenoir-Rhyne University","Home"),
               WOMEN_SCHOOL_GRIDS["lenoir"][0]:
                   grid("lenoir","Anderson University","Away")}
        games={}
        q=enrich_sac("women",games,directory(),dt.date(2026,11,1),lambda url:sites[url])
        self.assertEqual(q["school_grids_read"],2,q)
        self.assertEqual(q["added"],1,q)
        game=next(iter(games.values()))
        self.assertEqual((game["away"],game["home"]),("lenoir","anderson"))
        self.assertEqual(len(game["official_schedule_sources"]),2)
        self.assertEqual(game["start_time"],"5:30 PM ET")
        game["status"]="final";game["away_score"]=71;game["home_score"]=75
        old_id=game["id"]
        again=enrich_sac("women",games,directory(),dt.date(2026,11,1),
                         lambda url:sites[url])
        self.assertEqual(again["added"],0,again)
        self.assertEqual(game["id"],old_id)
        self.assertEqual((game["away_score"],game["home_score"]),(71,75))
    def test_unconfirmed_away_role_does_not_publish(self):
        sites={WOMEN_SCHOOL_GRIDS["anderson"][0]:
                   grid("anderson","Lenoir-Rhyne University","Home"),
               WOMEN_SCHOOL_GRIDS["lenoir"][0]:
                   grid("lenoir","Anderson University","Home")}
        games={}
        q=enrich_sac("women",games,directory(),dt.date(2026,11,1),lambda url:sites[url])
        self.assertEqual(q["added"],0)
        self.assertEqual(games,{})
if __name__=="__main__":
    unittest.main()

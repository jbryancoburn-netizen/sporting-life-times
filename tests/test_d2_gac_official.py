"""GAC official school calendar identity, reciprocal evidence, and no-guess tests."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_gac_official import BASE,SCHOOLS,school,identify,parse,enrich_gac

def page(gender,owner,opponent):
    tag="Women's" if gender=="women" else "Men's"
    rows=""
    for day in range(3,13):
        rows+=(f"<tr><td>12/{day}/2026</td><td>{opponent}</td><td>*</td>"
               "<td>Searcy, AR</td><td>7:30 P.M.</td></tr>")
    return (f"<html><title>2026-27 {owner} {tag} Basketball - Schedule - "
            "Great American Conference</title><table><tr><th>Date</th><th>Opponent</th>"
            "<th>GAC</th><th>Location</th><th>Time/Result</th></tr>"+rows+"</table></html>")

def fixture(gender):
    registered={name:{"name":aliases[0] if gender=="men" else
         (aliases[1] if len(aliases)>1 else aliases[0]),
         "conference":"GAC" if gender=="men" else "Great American Conference"}
         for name,aliases in SCHOOLS.items()}
    # Never infer source IDs: these fictitious IDs are confined to offline fixtures.
    ids={key:3201+i for i,key in enumerate(SCHOOLS)}
    html={}
    for key,aliases in SCHOOLS.items():
        opponent=("Arkansas Tech" if key=="harding" else
                  "at Harding" if key=="tech" else "at Harding")
        html[BASE+str(ids[key])]=page(gender,aliases[0],opponent)
    return registered,ids,html

class TestDiiGac(unittest.TestCase):
    def test_punctuation_and_gender_identity(self):
        self.assertEqual(school("Arkansas–Monticello"),"uam")
        self.assertEqual(school("University of Arkansas, Monticello"),"uam")
        self.assertEqual(school("Northwestern Oklahoma State University"),"nwosu")
        self.assertEqual(identify(page("men","Harding","Arkansas Tech")),("men","harding"))
        with self.assertRaises(ValueError):
            parse(page("women","Harding","at Arkansas Tech"),"men","harding")
        with self.assertRaises(ValueError):
            parse(page("men","Harding","at Arkansas Tech"),"men","tech")
    def test_strict_gac_marker_and_neutral_quarantine(self):
        html=page("men","Harding","vs. Arkansas Tech")
        with self.assertRaises(ValueError):parse(html,"men","harding")
        html=page("men","Harding","Arkansas Tech").replace("<td>*</td>","<td></td>")
        with self.assertRaises(ValueError):parse(html,"men","harding")
    def test_two_school_games_and_existing_score_preserved(self):
        for gender in ("men","women"):
            teams,ids,pages=fixture(gender)
            games={}
            r=enrich_gac(gender,games,teams,dt.date(2026,11,1),
                         previous={"source_schedule_ids":ids},fetcher=lambda u:pages[u])
            self.assertEqual(r["schools_read"],12,r)
            self.assertEqual(r["added"],10,r)
            self.assertEqual(len(games),10)
            game=next(iter(games.values()))
            self.assertEqual((game["away"],game["home"]),("tech","harding"))
            self.assertEqual(len(game["official_schedule_sources"]),2)
            self.assertNotIn("venue",game)
            self.assertNotIn("network",game)
            self.assertNotIn("start_time",game)
            game["status"]="final";game["away_score"]=60;game["home_score"]=75
            again=enrich_gac(gender,games,teams,dt.date(2026,11,1),
                             previous=r,fetcher=lambda u:pages[u])
            self.assertEqual(again["added"],0)
            self.assertEqual(game["status"],"final")
            self.assertEqual(game["away_score"],60)
    def test_only_both_school_pages_may_confirm_game(self):
        teams,ids,pages=fixture("men")
        pages[BASE+str(ids["tech"])]=page("men","Arkansas Tech","at Ouachita Baptist")
        games={}
        r=enrich_gac("men",games,teams,dt.date(2026,11,1),
                     previous={"source_schedule_ids":ids},fetcher=lambda u:pages[u])
        self.assertEqual(r["added"],0,r)
        self.assertGreater(r["one_sided"],0)
        self.assertEqual(games,{})
if __name__=="__main__":unittest.main()

"""Offline integrity checks for official PBC source identification and fixtures."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_pbc_official import BASE,SCHOOLS,SEEDS,identify,parse,team_ids,merge,inspect

def calendar(gender,school_name,opponent,date="12/2/2026"):
    label="Women's" if gender=="women" else "Men's"
    rows="".join(f"<tr><td>{12+i if i<20 else 12}/2/2026</td><td>{opponent}</td>"
                 "<td></td><td>7:30 P.M.</td><td></td></tr>" for i in range(12))
    # Include one uniquely dated header and at least 12 other rows to
    # exercise full-season threshold without depending on live sources.
    rows=(f"<tr><td>{date}</td><td>{opponent}</td><td></td>"
          "<td>7:30 P.M.</td><td></td></tr>")+rows
    return (f"<html><title>2026-27 {school_name} {label} Basketball - Peach Belt Conference</title>"
        "<table><tr><th>Date</th><th>Opponent</th><th>Notes</th>"
        "<th>Result</th><th>Status</th></tr>"+rows+"</table></html>")

class TestPbc(unittest.TestCase):
    def test_seed_is_official_sport_gender_specific_not_guessed(self):
        self.assertEqual(SEEDS["men"]["gsw"],3507)
        self.assertEqual(SEEDS["women"]["gsw"],3508)
        self.assertEqual(SEEDS["men"]["middle-georgia"],3566)
        self.assertEqual(SEEDS["women"]["middle-georgia"],3565)
        self.assertFalse(set(SEEDS["men"].values())&set(SEEDS["women"].values()))
    def test_official_full_form_team_names(self):
        for gender in ("men","women"):
            page=calendar(gender,"Georgia Southwestern State University",
                          "at Middle Georgia State University")
            self.assertEqual(identify(page),(gender,"gsw"))
            rows,bad=parse(page,gender,"gsw")
            self.assertEqual(len(rows),13)
            self.assertEqual(rows[0][:3],("2026-12-02","gsw","middle-georgia"))
            self.assertEqual(bad,0)
    def test_opposite_gender_and_wrong_owner_are_rejected(self):
        html=calendar("women","Georgia Southwestern State University",
                      "at Middle Georgia State University")
        with self.assertRaises(ValueError):parse(html,"men","gsw")
        with self.assertRaises(ValueError):parse(html,"women","augusta")
        self.assertIsNone(identify(calendar("women","Unknown South University","at Augusta")))
    def test_exact_registry_and_no_fuzzy_guess(self):
        source={
          "georgia-southwestern-state":{"name":"Georgia Southwestern State","conference":"PBC"},
          "middle-georgia":{"name":"Middle Georgia","conference":"PBC"}}
        ids,issues=team_ids(source)
        self.assertEqual(ids,{"gsw":"georgia-southwestern-state",
                              "middle-georgia":"middle-georgia"})
        self.assertFalse(issues)
        source["gsw-alias"]={"name":"Georgia Southwestern State University",
                             "conference":"Peach Belt Conference"}
        ids,issues=team_ids(source)
        self.assertIn("gsw",issues)
        self.assertNotIn("gsw",ids)
    def test_home_away_reciprocity_and_existing_verified_final(self):
        registry={"gsw":"georgia-southwestern-state",
                  "middle-georgia":"middle-georgia"}
        sources={
            "gsw":(3507,[("2026-12-02","gsw","middle-georgia","gsw")]),
            "middle-georgia":(3566,[("2026-12-02","gsw","middle-georgia","middle-georgia")])}
        games={}
        result=merge(games,sources,registry,"men",dt.date(2026,11,1))
        self.assertEqual(result["added"],1,result)
        game=next(iter(games.values()))
        self.assertEqual((game["away"],game["home"]),
          ("georgia-southwestern-state","middle-georgia"))
        self.assertEqual(len(game["official_schedule_sources"]),2)
        self.assertNotIn("venue",game)
        self.assertNotIn("network",game)
        self.assertNotIn("start_time",game)
        game.update(status="final",away_score=66,home_score=72)
        second=merge(games,sources,registry,"men",dt.date(2026,11,1))
        self.assertEqual(second["added"],0)
        self.assertEqual(game["away_score"],66)
        self.assertEqual(game["status"],"final")
        wrong={"middle-georgia":(3566,[("2026-12-02",
            "middle-georgia","gsw","middle-georgia")])}
        other={}
        self.assertEqual(merge(other,{**sources,**wrong},registry,"men",
                              dt.date(2026,11,1))["added"],0)
    def test_only_verified_source_title_is_accepted(self):
        okay=calendar("men","Middle Georgia State University",
                      "at Georgia Southwestern State University")
        fake=calendar("women","Middle Georgia State University",
                      "at Georgia Southwestern State University")
        pages={BASE+"3566":okay,BASE+"3565":fake}
        found,errors,dupes=inspect([3566,3565],"men",lambda u:pages[u])
        self.assertEqual(set(found),{"middle-georgia"})
        self.assertEqual(found["middle-georgia"][0],3566)
        self.assertFalse(dupes)
if __name__=="__main__":unittest.main()

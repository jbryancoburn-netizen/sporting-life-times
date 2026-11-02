"""SIAC 2026-27 source contracts: exact gender, school and reciprocal fixtures."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_siac_official import (BASE,SOURCES,ALIASES,school,explicit_et,
                              parse,index,enrich_siac)

def fixture_html(gender,owner,opponent,clock="7:30 P.M. ET"):
    word="Women's" if gender=="women" else "Men's"
    # An entire plausible university grid is required. Different school rows
    # are not evidence of a particular game's home/away until corroborated.
    other="at Allen" if owner=="Edward Waters" else "at Edward Waters"
    rows=(f"<tr><td>12/3/2026</td><td>*</td><td>{opponent}</td>"
          f"<td>School campus</td><td>{clock}</td><td></td></tr>")
    for day in range(5,14):
        rows+=(f"<tr><td>1/{day}/2027</td><td>*</td><td>{other}</td>"
               "<td>School campus</td><td>8:30 P.M. ET</td><td></td></tr>")
    return (f"<html><title>2026-27 {owner} {word} Basketball - SIAC</title>"
            "<table><tr><th>Date</th><th>Conference Game</th><th>Opponent</th>"
            "<th>Location</th><th>Time/Result</th><th>Custom Field 1</th></tr>"
            +rows+"</table></html>")

def registry(gender):
    conf="SIAC" if gender=="men" else "Southern Intercol. Ath. Conf."
    return {key:{"name":labels[0] if gender=="men" else labels[-1],
                 "conference":conf} for key,labels in ALIASES.items()
                 if gender=="men" or key!="morehouse"}

def pages(gender):
    result={}
    for sid,label in SOURCES[gender].items():
        opponent=("Savannah State" if label=="Edward Waters" else
                  "at Edward Waters" if label=="Savannah State" else
                  "at Edward Waters")
        result[BASE+str(sid)]=fixture_html(gender,label,opponent)
    return result

class TestSIAC(unittest.TestCase):
    def test_all_fifteen_men_fourteen_women_separate_source_ids(self):
        self.assertEqual(len(SOURCES["men"]),15)
        self.assertEqual(len(SOURCES["women"]),14)
        self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
        self.assertEqual(SOURCES["men"][2790],"Edward Waters")
        self.assertEqual(SOURCES["women"][2805],"Edward Waters")
        self.assertEqual(SOURCES["men"][2797],"Savannah State")
        self.assertEqual(SOURCES["women"][2811],"Savannah State")
    def test_exact_official_school_aliases_and_no_womens_morehouse(self):
        self.assertEqual(school("LeMoyne–Owen"),"lemoyne")
        self.assertEqual(school("Albany State University (Georgia)"),"albany")
        self.assertEqual(len(index(registry("men"))[0]),15)
        self.assertEqual(len(index(registry("women"))[0]),14)
        self.assertNotIn("morehouse",index(registry("women"))[0])
    def test_bad_gender_or_source_title_cannot_be_treated_as_real(self):
        sid=2790
        with self.assertRaises(ValueError):
            parse(fixture_html("women","Edward Waters","Savannah State"),"men",sid)
        with self.assertRaises(ValueError):
            parse(fixture_html("men","Savannah State","Edward Waters"),"men",sid)
        with self.assertRaises(ValueError):
            parse(fixture_html("men","Edward Waters","Savannah State")
                  .replace("2026-27","2025-26"),"men",sid)
    def test_eastern_tipoff_must_be_explicit(self):
        self.assertEqual(explicit_et("7:30 P.M. ET"),"7:30 PM ET")
        self.assertEqual(explicit_et("12:00 A.M. ET"),"12:00 AM ET")
        self.assertIsNone(explicit_et("7:30 P.M."))
        self.assertIsNone(explicit_et("TBA"))
    def test_two_school_corroboration_and_no_false_results(self):
        for gender in ("men","women"):
            with self.subTest(gender=gender):
                source=pages(gender)
                games={}
                report=enrich_siac(gender,games,registry(gender),
                     dt.date(2026,11,1),lambda url:source[url])
                self.assertEqual(report["schools_read"],len(SOURCES[gender]))
                self.assertEqual(report["added"],1,report)
                g=next(iter(games.values()))
                self.assertEqual((g["away"],g["home"]),("savannah","edward"))
                self.assertEqual(g["start_time"],"7:30 PM ET")
                self.assertEqual(len(g["official_schedule_sources"]),2)
                self.assertNotIn("venue",g)
                self.assertNotIn("network",g)
                g.update(status="final",away_score=64,home_score=73)
                again=enrich_siac(gender,games,registry(gender),
                    dt.date(2026,11,1),lambda url:source[url])
                self.assertEqual(again["added"],0)
                self.assertEqual(g["away_score"],64)
                self.assertEqual(g["status"],"final")
    def test_conflicting_times_do_not_create_fake_eastern_tipoff(self):
        src=pages("women")
        src[BASE+"2811"]=src[BASE+"2811"].replace("7:30 P.M. ET","8:30 P.M. ET")
        report_games={}
        audit=enrich_siac("women",report_games,registry("women"),
                   dt.date(2026,11,1),lambda url:src[url])
        self.assertEqual(audit["added"],1)
        self.assertGreater(audit["time_conflicts"],0)
        self.assertNotIn("start_time",next(iter(report_games.values())))
if __name__=="__main__":unittest.main()

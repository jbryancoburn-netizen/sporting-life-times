"""Offline GLVC 2026-27 official school-calendar validation and Elo safety."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_glvc_official import (BASE,SOURCES,SCHOOL_NAMES,school,parse,identities,
                              eastern_clock,enrich_glvc)

def grid(gender,owner,opponent=None,time="7:30 P.M. CT"):
    label=SCHOOL_NAMES[owner][0]
    sex="Women's" if gender=="women" else "Men's"
    rows=[]
    for day in range(2,12):
        opp=(opponent if day==2 and opponent else
             ("at Lewis" if owner=="drury" else "at Drury"))
        rows.append(f"<tr><td>12/{day}/2026</td><td>*</td><td>{opp}</td>"
                    f"<td>Springfield, Missouri</td><td>{time}</td></tr>")
    return (f"<html><head><title>2026-27 {label} {sex} Basketball Schedule "
            " - Great Lakes Valley Conference</title></head><body>"
            "<table><thead><tr><th>Date</th><th>C</th><th>Opponent</th>"
            "<th>Location</th><th>Time/Result</th></tr></thead>"
            "<tbody>"+''.join(rows)+"</tbody></table></body></html>")

def directory(gender):
    conf="GLVC" if gender=="men" else "Great Lakes Valley Conference"
    return {key:{"name":("Illinois–Springfield" if gender=="men" and key=="uis"
                    else "Lincoln University (Missouri)" if gender=="women" and key=="lincoln"
                    else "Maryville University of Saint Louis" if gender=="women" and key=="maryville"
                    else labels[-1]),"conference":conf}
            for key,labels in SCHOOL_NAMES.items()}

def site_pages(gender):
    out={}
    for sid,owner in SOURCES[gender].items():
        opponent="Lewis" if owner=="drury" else "at Drury" if owner=="lewis" else None
        out[BASE+str(sid)]=grid(gender,owner,opponent=opponent)
    return out

class GLVCTests(unittest.TestCase):
    def test_30_pinned_distinct_school_sources_and_identifiers(self):
        self.assertEqual(len(SOURCES["men"]),15)
        self.assertEqual(len(SOURCES["women"]),15)
        self.assertFalse(set(SOURCES["men"]).intersection(SOURCES["women"]))
        self.assertEqual(set(SOURCES["men"].values()),set(SCHOOL_NAMES))
        self.assertEqual(set(SOURCES["women"].values()),set(SCHOOL_NAMES))
        self.assertEqual(school("UMSL (Missouri–St. Louis)"),"umsl")
        self.assertEqual(school("Missouri S&T"),"mst")
        self.assertEqual(school("University of Illinois Springfield"),"uis")
        self.assertIsNone(school("Lincoln University Pennsylvania"))
    def test_independent_teams_of_both_genders_resolve(self):
        for g in ("men","women"):
            ids,amb=identities(g,directory(g))
            self.assertEqual(len(ids),15,g)
            self.assertEqual(amb,set())
            self.assertEqual(ids["lincoln"],"lincoln")
    def test_explicit_timezone_conversion_only(self):
        self.assertEqual(eastern_clock("7:30 P.M. CT"),"8:30 PM ET")
        self.assertEqual(eastern_clock("7:30 P.M. ET"),"7:30 PM ET")
        self.assertEqual(eastern_clock("11:30 P.M. CT"),"12:30 AM ET")
        self.assertIsNone(eastern_clock("TBA"))
        self.assertIsNone(eastern_clock("7:30 PM"))
        self.assertIsNone(eastern_clock("7:30 PM MT"))
    def test_reject_opposite_gender_wrong_school_wrong_year(self):
        sid=next(iter(SOURCES["men"]))
        with self.assertRaises(ValueError):parse(grid("women","drury"),"men",sid)
        with self.assertRaises(ValueError):parse(grid("men","lewis"),"men",sid)
        with self.assertRaises(ValueError):
            parse(grid("men","drury").replace("2026-27","2025-26"),"men",sid)
        with self.assertRaises(ValueError):parse(grid("men","drury"),"women",sid)
    def test_conference_marker_and_neutral_both_fail_closed(self):
        sid=next(iter(SOURCES["men"]))
        html=grid("men","drury",opponent="vs. Lewis")
        parsed=parse(html,"men",sid)
        self.assertFalse(any(x[0]=="2026-12-02" for x in parsed[1]))
        html=grid("men","drury").replace("<td>*</td>","<td></td>")
        with self.assertRaises(ValueError):parse(html,"men",sid)
    def test_two_school_reciprocal_games_and_unmodified_ncaa_finals(self):
        for gender in ("men","women"):
            with self.subTest(gender=gender):
                pages=site_pages(gender)
                games={}
                report=enrich_glvc(gender,games,directory(gender),dt.date(2026,11,1),
                                   lambda u:pages[u])
                self.assertEqual(report["schools_read"],15)
                self.assertEqual(report["added"],1,report)
                game=next(iter(games.values()))
                self.assertEqual((game["away"],game["home"]),("lewis","drury"))
                self.assertEqual(game["start_time"],"8:30 PM ET")
                self.assertEqual(len(game["official_schedule_sources"]),2)
                self.assertNotIn("network",game)
                self.assertNotIn("venue",game)
                stable_id=game["id"]
                game.update({"status":"final","away_score":76,"home_score":70})
                next_report=enrich_glvc(gender,games,directory(gender),dt.date(2026,11,1),
                                        lambda u:pages[u])
                self.assertEqual(next_report["added"],0,next_report)
                self.assertEqual(stable_id,game["id"])
                self.assertEqual((game["away_score"],game["home_score"]),(76,70))
                self.assertEqual(game["status"],"final")
    def test_opposite_home_away_roles_cannot_publish(self):
        pages=site_pages("men")
        for sid,owner in SOURCES["men"].items():
            if owner=="lewis":
                pages[BASE+str(sid)]=grid("men","lewis",opponent="Drury")
        games={}
        r=enrich_glvc("men",games,directory("men"),dt.date(2026,11,1),
                      lambda u:pages[u])
        self.assertEqual(r["added"],0,r)
        self.assertEqual(games,{})
    def test_one_sided_calendar_cannot_publish(self):
        pages=site_pages("women")
        for sid,owner in SOURCES["women"].items():
            if owner=="lewis":del pages[BASE+str(sid)]
        games={}
        report=enrich_glvc("women",games,directory("women"),dt.date(2026,11,1),
                           lambda u:pages[u])
        self.assertEqual(report["added"],0,report)
        self.assertEqual(games,{})
    def test_existing_canonical_ncaa_id_survives_with_verified_sources(self):
        pages=site_pages("men")
        game={"id":"6661234","date":"2026-12-02","away":"lewis","home":"drury",
              "away_score":None,"home_score":None,"status":"scheduled",
              "start_time":"8:30 PM ET","neutral":False,"elo_eligible":True}
        games={"6661234":game}
        report=enrich_glvc("men",games,directory("men"),dt.date(2026,11,1),
                           lambda u:pages[u])
        self.assertEqual(report["added"],0,report)
        self.assertEqual(len(games),1)
        self.assertEqual(game["id"],"6661234")
        self.assertEqual(len(game["official_schedule_sources"]),2)
    def test_past_unconfirmed_game_not_invented(self):
        games={}
        report=enrich_glvc("men",games,directory("men"),dt.date(2027,1,1),
                           lambda u:site_pages("men")[u])
        self.assertEqual(report["added"],0)
        self.assertFalse(games)
if __name__=="__main__":unittest.main()

"""Offline official NE10 DII schedule identity/provenance and gender tests."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_ne10_official import SOURCES,SCHOOLS,BASE,parse,enrich_ne10,school,time_et

def grid(gender,owner,dec_opponent,other_opponent="at Pace",clock="7:30 P.M."):
 word="Women's" if gender=="women" else "Men's"
 title=SCHOOLS[owner][0]
 rows=[]
 for day in range(11,19):
  rows.append(f"<tr><td>1/{day}/2027</td><td>{clock}</td><td>{other_opponent}</td>"
              "<td>Worcester, MA</td><td></td><td>*</td></tr>")
 rows.append(f"<tr><td>12/2/2026</td><td>{clock}</td><td>{dec_opponent}</td>"
             "<td>Waltham, MA</td><td></td><td>*</td></tr>")
 return (f"<html><title>2026-27 {title} {word} Basketball - Northeast 10 Conference</title>"
   "<table><tr><th>Date</th><th>Time</th><th>Opponent</th><th>Location</th>"
   "<th>Result</th><th>Conference</th></tr>"+''.join(rows)+"</table></html>")

def catalog(gender):
 result={}
 for sid,owner in SOURCES[gender].items():
  opposition=("at Bentley" if owner=="adelphi" else
              "Adelphi" if owner=="bentley" else
              "at Saint Michael's" if owner=="pace" else "at Pace")
  result[BASE+str(sid)]=grid(gender,owner,opposition,
                             "at Pace" if owner!="pace" else "at Southern New Hampshire")
 return result

def directory(gender):
 conf="NE-10" if gender=="men" else "Northeast 10 Conference"
 return {owner:{"name":names[0] if gender=="men" else names[1],
                "conference":conf} for owner,names in SCHOOLS.items()}

class TestNE10(unittest.TestCase):
 def test_all_unique_ids_and_exact_institution_aliases(self):
  self.assertEqual(len(SOURCES["men"]),10)
  self.assertEqual(len(SOURCES["women"]),10)
  self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
  self.assertEqual(school("Southern Connecticut State University"),"sconn")
  self.assertEqual(school("Saint Michael's College"),"michael")
 def test_wrong_gender_school_or_season_quarantined(self):
  sid=4100
  with self.assertRaises(ValueError):parse(grid("women","adelphi","at Bentley"),"men",sid)
  with self.assertRaises(ValueError):parse(grid("men","bentley","at Adelphi"),"men",sid)
  with self.assertRaises(ValueError):parse(grid("men","adelphi","at Bentley").replace("2026-27","2025-26"),"men",sid)
 def test_verified_eastern_tipoff(self):
  self.assertEqual(time_et("7:30 P.M."),"7:30 PM ET")
  self.assertEqual(time_et("12:00 A.M."),"12:00 AM ET")
  self.assertIsNone(time_et("TBA"))
  self.assertIsNone(time_et("5:00 CST"))
 def test_two_school_confirmation_and_preservation(self):
  for g in ("men","women"):
   with self.subTest(gender=g):
    pages=catalog(g)
    games={}
    q=enrich_ne10(g,games,directory(g),dt.date(2026,11,1),
                  lambda url:pages[url])
    self.assertEqual(q["schools_read"],10)
    self.assertEqual(q["added"],1,q)
    game=next(iter(games.values()))
    self.assertEqual((game["away"],game["home"]),("adelphi","bentley"))
    self.assertEqual(len(game["official_schedule_sources"]),2)
    self.assertEqual(game["start_time"],"7:30 PM ET")
    self.assertNotIn("network",game)
    game["status"]="final";game["away_score"]=77;game["home_score"]=66
    next_result=enrich_ne10(g,games,directory(g),dt.date(2026,11,1),
                            lambda url:pages[url])
    self.assertEqual(next_result["added"],0)
    self.assertEqual(game["away_score"],77)
    self.assertEqual(game["status"],"final")
 def test_missing_school_calendar_cannot_fabricate_one_sided_match(self):
  pages=catalog("women")
  pages.pop(BASE+"4113") # Bentley source absent
  games={}
  q=enrich_ne10("women",games,directory("women"),dt.date(2026,11,1),
                lambda u:pages[u])
  self.assertEqual(q["added"],0)
  self.assertEqual(games,{})
 def test_fails_closed_for_unknown_membership(self):
  teams=directory("men");teams.pop("adelphi")
  games={}
  q=enrich_ne10("men",games,teams,dt.date(2026,11,1),lambda u:catalog("men")[u])
  self.assertIn("held",q["status"])
  self.assertEqual(games,{})
if __name__=="__main__":unittest.main()

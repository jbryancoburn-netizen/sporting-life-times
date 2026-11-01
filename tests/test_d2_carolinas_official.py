"""Independent 2026-27 Conference Carolinas school-to-school match guards."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_carolinas_official import SOURCES,ALIASES,BASE,parse,enrich_carolinas

def html(gender,name,opponent):
 label="Women's" if gender=="women" else "Men's"
 return (f"<html><title>2026-27 {name} {label} Basketball - Conference Carolinas</title>"
  "<table><tr><th>Date</th><th>Opponent</th><th>Notes</th><th>Time/Result</th><th>Status</th></tr>"
  f"<tr><td>12/2/2026</td><td>{opponent}</td><td></td><td>7:00 p.m.</td><td></td></tr></table></html>")

def registry(gender):
 conf="Carolinas" if gender=="men" else "Conference Carolinas"
 return {ident:{"name":names[-1] if gender=="women" else names[0],"conference":conf}
         for ident,names in ALIASES.items()}

def sources(gender):
 records={}
 for sid,label in SOURCES[gender].items():
  opponent=("Barton" if label=="Chowan" else "at Chowan" if label=="Barton"
            else "at Chowan")
  records[BASE+str(sid)]=html(gender,label,opponent)
 return records

class TestCarolinas(unittest.TestCase):
 def test_two_16_school_official_gender_specific_sources(self):
  self.assertEqual(len(SOURCES["men"]),16)
  self.assertEqual(len(SOURCES["women"]),16)
  self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
 def test_reject_cross_gender_bad_season_and_neutral(self):
  sid=next(iter(SOURCES["men"]));name=SOURCES["men"][sid]
  with self.assertRaises(ValueError):parse(html("women",name,"Chowan"),"men",sid)
  with self.assertRaises(ValueError):parse(html("men",name,"vs. Chowan"),"men",sid)
  with self.assertRaises(ValueError):parse(html("men",name,"at Barton"),"men",sid)
 def test_source_provenance_and_stable_original_final(self):
  for gender in ("men","women"):
   records=sources(gender);games={}
   audit=enrich_carolinas(gender,games,registry(gender),dt.date(2026,11,1),lambda url:records[url])
   self.assertEqual(audit["added"],1,audit)
   game=next(iter(games.values()))
   self.assertEqual((game["away"],game["home"]),("barton","chowan"))
   self.assertEqual(len(game["official_schedule_sources"]),2)
   self.assertNotIn("network",game)
   self.assertNotIn("venue",game)
   game["status"]="final";game["away_score"]=61;game["home_score"]=72
   second=enrich_carolinas(gender,games,registry(gender),dt.date(2026,11,1),lambda url:records[url])
   self.assertEqual(second["added"],0)
   self.assertEqual(game["status"],"final")
   self.assertEqual(game["home_score"],72)
 def test_missing_calendar_does_not_fabricate_match(self):
  records=sources("women")
  first=list(records)[0];records.pop(first)
  out={}
  audit=enrich_carolinas("women",out,registry("women"),dt.date(2026,11,1),lambda url:records[url])
  self.assertEqual(out,{})
  self.assertEqual(audit["added"],0)
if __name__=="__main__":unittest.main()

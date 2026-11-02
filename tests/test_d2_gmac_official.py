"""Great Midwest official 2026-27 schedule fail-closed identity tests."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_gmac_official import (BASE,CANDIDATE_IDS,LABELS,parse,identities,
                               school,enrich_gmac)

def grid(owner,gender,against=None):
  title=LABELS[owner][-1]
  sex="Women's" if gender=="women" else "Men's"
  row=[]
  for i in range(3,9):
    opp=("Walsh" if owner=="ashland" else "at Ashland" if owner=="walsh" else "at Walsh")
    if i==3 and against:opp=against
    role="A" if opp.startswith("at ") else "H"
    row.append(f"<tr><td>12/{i}/2026</td><td>*</td><td>{opp}</td><td>{role}</td><td>7:30 P.M.</td></tr>")
  return (f"<html><title>2026-27 {title} {sex} Basketball - Great Midwest Athletic Conference</title>"
    "<table><thead><tr><th>Date</th><th>C</th><th>Opponent</th><th>H/A</th>"
    "<th>Time/Result</th></tr></thead><tbody>"+''.join(row)+"</tbody></table></html>")

def directory(gender):
  conference="G-MAC" if gender=="men" else "Great Midwest Athletic Conference"
  return {key:{"name":names[-1] if gender=="women" else names[0],"conference":conference}
          for key,names in LABELS.items() if gender=="women" or key!="ursuline"}

def sources(gender):
  return {BASE+str(4060+i):grid(key,gender) for i,key in
          enumerate(directory(gender))}

class TestGmac(unittest.TestCase):
 def test_official_registry_and_both_genders(self):
  self.assertEqual(school("Thomas More University"),"thomasmore")
  self.assertEqual(school("Ohio Dominican"),"ohiodom")
  self.assertIsNone(school("Truman State"))
  for sex,n in (("men",12),("women",13)):
   ids,conflicts=identities(sex,directory(sex))
   self.assertEqual(len(ids),n)
   self.assertFalse(conflicts)
 def test_validate_title_date_conference_and_role(self):
  html=grid("ashland","men")
  owner,rows,bad=parse(html,"men",4060)
  self.assertEqual(owner,"ashland")
  self.assertEqual(len(rows),6)
  with self.assertRaises(ValueError):
   parse(grid("ashland","women"),"men",4060)
  with self.assertRaises(ValueError):
   parse(html.replace("2026-27","2025-26"),"men",4060)
  with self.assertRaises(ValueError):
   parse(html.replace("<td>*</td>","<td></td>"),"men",4060)
  with self.assertRaises(ValueError):
   parse(html.replace("<td>H</td>","<td>N</td>"),"men",4060)
 def test_two_school_approval_and_ncaa_final_preservation(self):
  for gender in ("men","women"):
   with self.subTest(gender=gender):
    pages=sources(gender)
    games={}
    quality=enrich_gmac(gender,games,directory(gender),
                        dt.date(2026,11,1),lambda u:pages[u])
    self.assertGreaterEqual(quality["confirmed_matchups"],1,quality)
    self.assertGreaterEqual(quality["added"],1,quality)
    selection=[g for g in games.values() if g["date"]=="2026-12-03"
               and g["away"]=="walsh" and g["home"]=="ashland"]
    self.assertEqual(len(selection),1,quality)
    game=selection[0]
    self.assertEqual(len(game["official_schedule_sources"]),2)
    self.assertNotIn("start_time",game)
    self.assertNotIn("venue",game)
    games[game["id"]].update({"status":"final","away_score":70,"home_score":72})
    again=enrich_gmac(gender,games,directory(gender),dt.date(2026,11,1),
                      lambda u:pages[u])
    self.assertEqual(again["added"],0)
    self.assertEqual((game["away_score"],game["home_score"]),(70,72))
    self.assertEqual(game["status"],"final")
 def test_one_sided_home_away_disagreement_quarantined(self):
  pages=sources("men")
  walsh_index=list(directory("men")).index("walsh")
  pages[BASE+str(4060+walsh_index)]=grid("walsh","men","Ashland")
  games={}
  enrich_gmac("men",games,directory("men"),dt.date(2026,11,1),lambda u:pages[u])
  self.assertFalse(any(g["away"]=="walsh" and g["home"]=="ashland"
                       for g in games.values()))
 def test_no_games_when_directory_ambiguous_or_expired(self):
  team=directory("women");team.pop("ursuline")
  games={}
  q=enrich_gmac("women",games,team,dt.date(2026,11,1),
                lambda u:sources("women")[u])
  self.assertIn("held",q["status"])
  self.assertFalse(games)
  games={}
  q=enrich_gmac("men",games,directory("men"),dt.date(2027,2,1),
                lambda u:sources("men")[u])
  self.assertEqual(q["added"],0)
if __name__=="__main__":unittest.main()

"""Offline NSIC 2026-27 dual-university confirmation and women's full-name tests."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_nsic_official import BASE,SOURCES,ALIASES,school,parse,enrich_nsic
from d2_rmac_official import team_ids as rmac_ids

def html(gender,name,opponent,role="H",conf="*"):
    word="Women's" if gender=="women" else "Men's"
    return (f"<html><title>2026-27 {name} {word} Basketball - Northern Sun</title>"
      "<table><tr><th>Date</th><th>Conference Game</th><th>Opponent</th>"
      "<th>Location</th><th>Home / Away</th><th>Time/Result</th></tr>"
      f"<tr><td>12/3/2026</td><td>{conf}</td><td>{opponent}</td>"
      f"<td>Bemidji, MN</td><td>{role}</td><td>5:30 P.M.</td></tr></table></html>")

def teams(long=False):
    gender_conf="Northern Sun Intercollegiate Conference" if long else "NSIC"
    return {key:{"name":labels[-1] if long else labels[0],"conference":gender_conf}
           for key,labels in ALIASES.items()}

def files(gender):
    sources={}
    ids=list(SOURCES[gender])[:13]
    a=next(k for k,v in SOURCES[gender].items() if v=="Augustana")
    b=next(k for k,v in SOURCES[gender].items() if v=="Bemidji State")
    for sid in ids:
        if sid==a:op,role="Bemidji State University","H"
        elif sid==b:op,role="at Augustana University","A"
        else:op,role="at Augustana University","A"
        sources[BASE+str(sid)]=html(gender,SOURCES[gender][sid],op,role)
    return sources

class TestNsic(unittest.TestCase):
    def test_all_32_source_ids_and_full_form_names(self):
        self.assertEqual(len(SOURCES["men"]),16)
        self.assertEqual(len(SOURCES["women"]),16)
        self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
        self.assertEqual(school("Wayne State College (Nebraska)"),"wayne")
        self.assertEqual(school("Concordia University, St. Paul"),"concordia")
    def test_moorhead_uses_full_official_2026_27_school_name(self):
        for gender in ("men","women"):
            sid=next(k for k,v in SOURCES[gender].items() if v=="MSU Moorhead")
            rows,rejected=parse(html(gender,"Minnesota State University Moorhead",
                                     "at Augustana",role="A"),gender,sid)
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0][1],"moorhead")
            self.assertEqual(rows[0][2],"augustana")
            self.assertEqual(rejected,0)
            # Mankato is a DIFFERENT school, not a spelling of Moorhead.
            with self.assertRaises(ValueError):
                parse(html(gender,"Minnesota State University Mankato",
                           "at Augustana",role="A"),gender,sid)
    def test_genders_and_home_away_roles_are_strict(self):
        sid=next(iter(SOURCES["men"]));n=SOURCES["men"][sid]
        with self.assertRaises(ValueError):parse(html("women",n,"Bemidji State"),"men",sid)
        with self.assertRaises(ValueError):parse(html("men",n,"at Bemidji State","H"),"men",sid)
        with self.assertRaises(ValueError):parse(html("men",n,"vs. Bemidji State","N"),"men",sid)
    def test_publish_only_exact_reciprocity_and_never_erase_finals(self):
        src=files("men");out={}
        audit=enrich_nsic("men",out,teams(),dt.date(2026,11,1),lambda url:src[url])
        self.assertEqual(audit["added"],1,audit)
        g=next(iter(out.values()))
        self.assertEqual((g["away"],g["home"]),("bemidji","augustana"))
        self.assertEqual(len(g["official_schedule_sources"]),2)
        self.assertNotIn("start_time",g)
        g["status"]="final";g["away_score"]=71;g["home_score"]=68
        audit=enrich_nsic("men",out,teams(),dt.date(2026,11,1),lambda url:src[url])
        self.assertEqual(audit["added"],0)
        self.assertEqual(g["away_score"],71)
        self.assertEqual(g["status"],"final")
    def test_womens_full_conference_names(self):
        src=files("women");out={}
        audit=enrich_nsic("women",out,teams(long=True),dt.date(2026,11,1),lambda url:src[url])
        self.assertEqual(audit["added"],1,audit)
    def test_health_threshold_withholds_partial_sources(self):
        src=files("men");src=dict(list(src.items())[:12]);out={}
        audit=enrich_nsic("men",out,teams(),dt.date(2026,11,1),lambda url:src[url])
        self.assertEqual(out,{})
        self.assertIn("held",audit["status"])
    def test_womens_rmac_full_conference_and_parenthetical_names(self):
        catalog={
         "adams":{"name":"Adams State University","conference":"Rocky Mountain Athletic Conference"},
         "mines":{"name":"South Dakota School of Mines & Technology","conference":"Rocky Mountain Athletic Conference"},
         "regis":{"name":"Regis University (Colorado)","conference":"Rocky Mountain Athletic Conference"},
         "westminster":{"name":"Westminster University (Utah)","conference":"Rocky Mountain Athletic Conference"}}
        found,ambiguous=rmac_ids(catalog)
        self.assertEqual(len(found),4,found)
        self.assertFalse(ambiguous)
if __name__=="__main__":unittest.main()

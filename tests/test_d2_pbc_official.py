"""Safe offline PBC reconciliation tests, both DII genders and original finals."""
import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_pbc_official import SOURCES,SCHOOLS,BASE,school,time_et,parse,enrich_pbc

def html(gender,label,opponent="at Augusta",times="7:30 P.M."):
    sex="Women's" if gender=="women" else "Men's"
    # Every school has a plausible-length fixture grid so one malformed
    # example cannot masquerade as an entire season.
    rows=[]
    for day in range(11,19):
        rows.append(f"<tr><td>1/{day}/2027</td><td>{opponent}</td>"
                    f"<td></td><td>{times}</td><td></td></tr>")
    rows.append(f"<tr><td>12/2/2026</td><td>{opponent}</td>"
                f"<td></td><td>{times}</td><td></td></tr>")
    return (f"<html><title>2026-27 {label} {sex} Basketball - Peach Belt Conference</title>"
            "<table><tr><th>Date</th><th>Opponent</th><th>Notes</th><th>Result</th>"
            "<th>Status</th></tr>"+''.join(rows)+"</table></html>")

def catalog(gender):
    pages={}
    for sid,owner in SOURCES[gender].items():
        label=SCHOOLS[owner][0]
        # The only reciprocal verified fixture is Georgia Southwestern at Augusta,
        # December 2. All other calendar rows remain one-sided.
        opponent=("at Augusta" if owner=="georgia-southwestern" else
                  "Georgia Southwestern" if owner=="augusta" else
                  "at Augusta")
        pages[BASE+str(sid)]=html(gender,label,opponent)
    return pages

def teams(gender):
    conf="PBC" if gender=="men" else "Peach Belt Conference"
    return {k:{"name":labels[0] if gender=="men" else labels[-1],
               "conference":conf} for k,labels in SCHOOLS.items()}

class TestPBC(unittest.TestCase):
    def test_22_confirmed_source_ids_are_gender_isolated(self):
        self.assertEqual(len(SOURCES["men"]),11)
        self.assertEqual(len(SOURCES["women"]),11)
        self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
        self.assertEqual(school("University of South Carolina Beaufort"),"uscb")
        self.assertEqual(school("Georgia College & State University"),"georgia-college")
    def test_strict_source_year_gender_and_owner(self):
        sid=next(iter(SOURCES["men"]))
        label=SCHOOLS[SOURCES["men"][sid]][0]
        with self.assertRaises(ValueError):parse(html("women",label),"men",sid)
        with self.assertRaises(ValueError):parse(html("men",label).replace("2026-27","2025-26"),"men",sid)
        with self.assertRaises(ValueError):parse(html("men","Lander"),"men",sid)
    def test_verified_local_tipoff_not_guessed(self):
        self.assertEqual(time_et("7:45 P.M."),"7:45 PM ET")
        self.assertEqual(time_et("12:00 A.M."),"12:00 AM ET")
        self.assertIsNone(time_et("TBA"))
        self.assertIsNone(time_et("7:00 Central"))
    def test_gender_specific_reciprocal_only_and_evidence(self):
        for gender in ("men","women"):
            with self.subTest(gender=gender):
                pages=catalog(gender)
                data={}
                audit=enrich_pbc(gender,data,teams(gender),dt.date(2026,11,1),
                                 lambda url:pages[url])
                self.assertEqual(audit["schools_read"],11)
                self.assertEqual(audit["added"],1,audit)
                game=next(iter(data.values()))
                self.assertEqual((game["away"],game["home"]),
                                 ("georgia-southwestern","augusta"))
                self.assertEqual(game["date"],"2026-12-02")
                self.assertEqual(game["start_time"],"7:30 PM ET")
                self.assertEqual(len(game["official_schedule_sources"]),2)
                self.assertNotIn("venue",game)
                self.assertNotIn("network",game)
                game["status"]="final";game["home_score"]=78;game["away_score"]=65
                again=enrich_pbc(gender,data,teams(gender),dt.date(2026,11,1),
                                 lambda url:pages[url])
                self.assertEqual(again["added"],0)
                self.assertEqual(game["home_score"],78)
                self.assertEqual(game["status"],"final")
    def test_withhold_one_sided_missing_school(self):
        pages=catalog("men")
        sid=next(sid for sid,k in SOURCES["men"].items() if k=="georgia-southwestern")
        pages.pop(BASE+str(sid))
        games={}
        audit=enrich_pbc("men",games,teams("men"),dt.date(2026,11,1),
                         lambda url:pages[url])
        self.assertEqual(games,{})
        self.assertEqual(audit["added"],0)
        self.assertGreater(audit["one_sided"],0)
    def test_identity_registry_and_unknown_teams_block(self):
        directory=teams("women")
        del directory["georgia-southwestern"]
        out={}
        audit=enrich_pbc("women",out,directory,dt.date(2026,11,1),
                         lambda url:catalog("women")[url])
        self.assertEqual(out,{})
        self.assertIn("held",audit["status"])
if __name__=="__main__":
    unittest.main()

"""Offline ECC 2026-27 university schedule identity and reciprocal-fixture tests."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_ecc_official import (BASE,CANDIDATE_IDS,SCHOOL_NAMES,school,identities,
                             eastern_clock,parse,enrich_ecc)

OWNERS=list(SCHOOL_NAMES)

def html(gender,owner,opponent,clock="7:30 P.M.",date="1/7/2027"):
    sex="Men's" if gender=="men" else "Women's"
    title=SCHOOL_NAMES[owner][1]
    return (f"<html><head><title>2026-27 {title} {sex} Basketball - "
            "Schedule - East Coast Conference</title></head><body>"
            "<table><thead><tr><th>Date</th><th>Opponent</th>"
            "<th>Status</th><th>Result</th></tr></thead><tbody>"
            f"<tr><td>{date}</td><td>{opponent}</td><td></td>"
            f"<td>{clock}</td></tr></tbody></table></body></html>")

def teams(gender):
    conference="ECC" if gender=="men" else "East Coast Conference"
    return {key:{"name":({"queens":"Queens (NY)","csi":"Staten Island",
            "udc":"UDC","dyouville":"D'Youville"}.get(key,SCHOOL_NAMES[key][1]))
                         if gender=="men" else
                         ({"queens":"Queens College (New York)"}.get(key,SCHOOL_NAMES[key][1])),
                 "conference":conference} for key in OWNERS}

def pages(gender,clock="7:30 P.M."):
    # Every source page is separately title/season/gender validated. Only
    # Daemen and Roberts independently corroborate the same exact game.
    out={}
    for i,owner in enumerate(OWNERS):
        sid=CANDIDATE_IDS[i]
        opposition=("Roberts Wesleyan" if owner=="daemen" else
                    "at Daemen" if owner=="roberts" else "at Daemen")
        out[BASE+str(sid)]=html(gender,owner,opposition,clock)
    return out

class TestECC(unittest.TestCase):
    def test_exact_names_and_gender_registry(self):
        self.assertEqual(len(OWNERS),9)
        self.assertEqual(school("D’Youville"),"dyouville")
        self.assertEqual(school("Queens (N.Y.)"),"queens")
        self.assertEqual(school("College of Staten Island"),"csi")
        self.assertEqual(school("St. Thomas Aquinas College"),"stac")
        self.assertEqual(school("District of Columbia"),"udc")
        self.assertIsNone(school("Lincoln University (MO)"))
        for gender in ("men","women"):
            ids,errors=identities(gender,teams(gender))
            self.assertEqual(len(ids),9)
            self.assertEqual(errors,set())
    def test_genuine_eastern_clocks_only(self):
        self.assertEqual(eastern_clock("7:30 P.M."),"7:30 PM ET")
        self.assertEqual(eastern_clock("12:00 A.M."),"12:00 AM ET")
        self.assertIsNone(eastern_clock("TBA"))
        self.assertIsNone(eastern_clock("4:30 CT"))
    def test_wrong_season_gender_school_and_neutral_held(self):
        sid=CANDIDATE_IDS[0]
        with self.assertRaises(ValueError):
            parse(html("women","csi","Roberts Wesleyan"),"men",sid)
        with self.assertRaises(ValueError):
            parse(html("men","csi","Roberts Wesleyan").replace("2026-27","2025-26"),"men",sid)
        with self.assertRaises(ValueError):
            parse(html("men","csi","vs. Roberts Wesleyan"),"men",sid)
        with self.assertRaises(ValueError):
            parse(html("men","csi","Anderson University"),"men",sid)
    def test_reciprocity_and_final_score_id_preservation(self):
        for gender in ("men","women"):
            with self.subTest(gender=gender):
                source=pages(gender)
                games={}
                q=enrich_ecc(gender,games,teams(gender),dt.date(2026,11,1),
                             lambda u:source[u])
                self.assertEqual(q["schools_read"],9,q)
                self.assertEqual(q["added"],1,q)
                g=next(iter(games.values()))
                self.assertEqual((g["away"],g["home"]),("roberts","daemen"))
                self.assertEqual(len(g["official_schedule_sources"]),2)
                self.assertEqual(g["start_time"],"7:30 PM ET")
                g.update({"id":"ncaa-actual-123","status":"final",
                          "away_score":74,"home_score":72,"verified":True})
                games={"ncaa-actual-123":g}
                second=enrich_ecc(gender,games,teams(gender),dt.date(2026,11,1),
                                   lambda u:source[u])
                self.assertEqual(second["added"],0,second)
                self.assertEqual(g["id"],"ncaa-actual-123")
                self.assertEqual((g["away_score"],g["home_score"]),(74,72))
                self.assertEqual(g["status"],"final")
    def test_one_sided_opposite_role_and_duplicate_hold(self):
        source=pages("men")
        daemen_sid=CANDIDATE_IDS[OWNERS.index("daemen")]
        roberts_sid=CANDIDATE_IDS[OWNERS.index("roberts")]
        source[BASE+str(roberts_sid)]=html("men","roberts","Daemen")
        games={}
        out=enrich_ecc("men",games,teams("men"),dt.date(2026,11,1),
                        lambda u:source[u])
        self.assertEqual(out["added"],0)
        self.assertFalse(games)
        source.pop(BASE+str(roberts_sid))
        out=enrich_ecc("men",games,teams("men"),dt.date(2026,11,1),
                        lambda u:source[u])
        self.assertEqual(out["added"],0)
        source[BASE+str(roberts_sid)]=html("men","roberts","at Daemen")
        extra=CANDIDATE_IDS[-1]
        source[BASE+str(extra)]=html("men","daemen","Roberts Wesleyan")
        out=enrich_ecc("men",games,teams("men"),dt.date(2026,11,1),
                        lambda u:source[u])
        self.assertEqual(out["added"],0)
    def test_no_postdated_invention_or_foreign_team(self):
        out=enrich_ecc("women",{},teams("women"),dt.date(2027,2,1),
                        lambda u:pages("women")[u])
        self.assertEqual(out["added"],0,out)
        directory=teams("men");directory.pop("udc")
        games={}
        out=enrich_ecc("men",games,directory,dt.date(2026,11,1),
                        lambda u:pages("men")[u])
        self.assertIn("held",out["status"])
        self.assertEqual(games,{})
if __name__=="__main__":unittest.main()

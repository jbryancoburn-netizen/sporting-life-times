"""Offline fail-closed SAC 2026-27 official university calendar tests."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from d2_sac_official import (BASE, LABELS, SOURCES, school, parse,
                             identities, enrich_sac, et_clock)

SCHOOL_ORDER=list(LABELS)

def grid(gender, owner, special=None, time="4:00 P.M."):
    sex = "Men's" if gender == "men" else "Women's"
    cols = ("<th>Date</th><th>Opponent</th><th>Location</th><th>Result</th>"
            "<th>Status</th><th>Notes</th>" if gender=="men" else
            "<th>Date</th><th>Opponent</th><th>Result</th><th>Location</th>"
            "<th>Status</th><th>Notes</th>")
    rows=[]
    for day in range(2, 11):
        rival = special if day == 2 and special else ("at Coker University" if owner=="newberry" else "at Newberry College")
        cells = [f"1/{day}/2027", rival, "Hickory, NC", time, "", ""]
        if gender == "women":
            cells[2], cells[3] = cells[3], cells[2]
        rows.append("<tr>"+"".join("<td>"+x+"</td>" for x in cells)+"</tr>")
    return (f"<html><title>2026-27 {LABELS[owner][-1]} {sex} Basketball - "
            "Schedule - South Atlantic Conference</title><table>"
            "<tr>"+cols+"</tr>"+ "".join(rows)+"</table></html>")

def pages(gender):
    result={}
    for index, sid in enumerate(SOURCES[gender]):
        owner=SCHOOL_ORDER[index]
        special=("Coker University" if owner=="anderson" else
                 "at Anderson University" if owner=="coker" else None)
        result[BASE+str(sid)] = grid(gender,owner,special)
    return result

def directory(gender):
    conf = "SAC" if gender=="men" else "South Atlantic Conference"
    return {key:{"name":labels[0] if gender=="men" else labels[-1],
                 "conference":conf} for key,labels in LABELS.items()}

class SACOfficialTests(unittest.TestCase):
    def test_exact_gender_specific_source_ranges_and_aliases(self):
        self.assertEqual(len(SOURCES["men"]),len(SOURCES["women"]))
        self.assertEqual(len(SOURCES["women"]),12)
        self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
        self.assertEqual(school("Carson–Newman"),"carson")
        self.assertEqual(school("The University of Virginia's College at Wise"),"wise")
        self.assertEqual(school("Emory & Henry University"),"emory")
        self.assertIsNone(school("Anderson University Indiana"))
    def test_grid_rejects_wrong_gender_year_owner_and_neutral(self):
        sid=SOURCES["men"][0]
        with self.assertRaises(ValueError):
            parse(grid("women","anderson"),"men",sid)
        with self.assertRaises(ValueError):
            parse(grid("men","anderson").replace("2026-27","2025-26"),"men",sid)
        with self.assertRaises(ValueError):
            parse(grid("men","anderson").replace("Anderson University","Anderson University Indiana"),"men",sid)
        owner, rows, rejected=parse(grid("men","anderson","vs. Coker University"),"men",sid)
        self.assertEqual(owner,"anderson")
        self.assertFalse(any(x[0]=="2027-01-02" for x in rows))
        self.assertGreater(rejected,0)
    def test_eastern_only_both_clocks_agree(self):
        self.assertEqual(et_clock("4:00 P.M."),"4:00 PM ET")
        self.assertIsNone(et_clock("TBA"))
        self.assertIsNone(et_clock("6:00 CT"))
    def test_recipient_specific_school_identity(self):
        for g in ("men","women"):
            ids, conflicts=identities(g,directory(g))
            self.assertEqual(len(ids),12)
            self.assertFalse(conflicts)
            self.assertEqual(ids["anderson"],"anderson")
    def test_reciprocal_publish_both_genders_preserve_final(self):
        for gender in ("men","women"):
            with self.subTest(gender=gender):
                source=pages(gender)
                games={}
                audit=enrich_sac(gender,games,directory(gender),dt.date(2026,11,1),
                                 lambda u:source[u])
                self.assertGreaterEqual(audit["reciprocal_matchups"],1,audit)
                matched=[x for x in games.values() if x["away"]=="coker" and x["home"]=="anderson"]
                self.assertEqual(len(matched),1)
                game=matched[0]
                self.assertEqual(len(game["official_schedule_sources"]),2)
                self.assertEqual(game["start_time"],"4:00 PM ET")
                self.assertNotIn("network",game)
                self.assertNotIn("venue",game)
                game.update({"status":"final","away_score":67,"home_score":71,"verified":True})
                audit2=enrich_sac(gender,games,directory(gender),dt.date(2026,11,1),
                                  lambda u:source[u])
                self.assertEqual(audit2["added"],0,audit2)
                self.assertEqual((game["away_score"],game["home_score"]),(67,71))
                self.assertEqual(game["status"],"final")
    def test_one_sided_and_role_conflict_never_publish(self):
        source=pages("men")
        coker_sid=SOURCES["men"][SCHOOL_ORDER.index("coker")]
        source[BASE+str(coker_sid)]=grid("men","coker","Anderson University")
        games={}
        enrich_sac("men",games,directory("men"),dt.date(2026,11,1),lambda u:source[u])
        self.assertFalse(any(x["away"]=="coker" and x["home"]=="anderson"
                             for x in games.values()))
    def test_missing_calendar_never_invents_partner(self):
        source=pages("women")
        coker_sid=SOURCES["women"][SCHOOL_ORDER.index("coker")]
        source.pop(BASE+str(coker_sid))
        games={}
        enrich_sac("women",games,directory("women"),dt.date(2026,11,1),
                   lambda u:source[u])
        self.assertFalse(any(x["away"]=="coker" and x["home"]=="anderson"
                             for x in games.values()))
    def test_ambiguous_membership_fails_closed(self):
        teams=directory("women")
        teams.pop("anderson")
        games={}
        audit=enrich_sac("women",games,teams,dt.date(2026,11,1),
                         lambda u:pages("women")[u])
        self.assertIn("held",audit["status"])
        self.assertEqual(games,{})
    def test_no_new_past_fixture_without_ncaa_result(self):
        games={}
        audit=enrich_sac("men",games,directory("men"),dt.date(2027,1,3),
                         lambda u:pages("men")[u])
        self.assertEqual(audit["added"],0,audit)
if __name__=="__main__":
    unittest.main()

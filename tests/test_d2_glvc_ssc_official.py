"""Official school-calendar parsing and reciprocal GLVC/SSC recovery safety."""
import datetime as dt
import unittest
from scripts.d2_glvc_ssc_official import (
    SOURCES, BASES, ALIASES, eastern_clock, format_et, parse, enrich,
)

def fake_grid(school, opponent, gender="men", conference="SSC",
              home=True, dates=None, clock="7:30 PM"):
    title=f"2026-27 {school} {\"Men's\" if gender=='men' else \"Women's\"} Basketball - Schedule - "+(
        "Sunshine State Conference" if conference=="SSC" else "Great Lakes Valley Conference")
    flag="SSC" if conference=="SSC" else "C"
    days=dates or [f"11/{day}/2026" for day in range(18,26)]
    rows="".join(
        "<tr><td>"+day+"</td><td>*</td><td>"+
        ("" if home else "at ")+opponent+"</td><td>Home</td><td>"+
        clock+"</td></tr>" for day in days)
    return (f"<html><head><title>{title}</title></head><body><table><thead>"
        f"<tr><th>Date</th><th>{flag}</th><th>Opponent</th>"
        f"<th>Location</th><th>Time/Result</th></tr></thead><tbody>"
        +rows+"</tbody></table></body></html>")

class OfficialTwoLeagueTests(unittest.TestCase):
    def test_all_verified_school_ids_are_isolated_by_gender(self):
        for conf,count in (("GLVC",15),("SSC",11)):
            self.assertEqual(len(SOURCES[conf]["men"]),count)
            self.assertEqual(len(SOURCES[conf]["women"]),count)
            self.assertFalse(set(SOURCES[conf]["men"]) & set(SOURCES[conf]["women"]))
            self.assertEqual(set(SOURCES[conf]["men"].values()),set(ALIASES[conf]))
            self.assertEqual(set(SOURCES[conf]["women"].values()),set(ALIASES[conf]))

    def test_accept_official_calendar_but_reject_wrong_gender_school_year(self):
        sid=4702
        page=fake_grid("Barry","Eckerd")
        rows,bad=parse(page,"SSC","men",sid)
        self.assertEqual(len(rows),8)
        self.assertEqual(rows[0][1:4],("eckerd","barry","barry"))
        self.assertEqual(rows[0][4],"7:30 PM ET")
        for wrong in (page.replace("Men's","Women's"),
                      page.replace("2026-27","2025-26"),
                      page.replace("Barry","Lynn"),
                      page.replace("Sunshine State Conference","Unknown League")):
            with self.assertRaises(ValueError):
                parse(wrong,"SSC","men",sid)
        with self.assertRaises(ValueError):
            parse(page,"SSC","women",sid)
        with self.assertRaises(ValueError):
            parse(page,"GLVC","men",sid)

    def test_neutral_games_and_misidentified_opponents_are_quarantined(self):
        page=fake_grid("Barry","vs. Eckerd")
        with self.assertRaises(ValueError):
            parse(page,"SSC","men",4702)
        page=fake_grid("Barry","School Nobody Knows")
        with self.assertRaises(ValueError):
            parse(page,"SSC","men",4702)

    def test_explicit_ct_clocks_are_converted_correctly(self):
        self.assertEqual(format_et(dt.date(2026,11,30),eastern_clock("7:30 P.M. CT","GLVC")),
                         "8:30 PM ET")
        self.assertEqual(format_et(dt.date(2027,2,20),eastern_clock("3:00 P.M. CT","GLVC")),
                         "4:00 PM ET")
        self.assertEqual(format_et(dt.date(2026,11,21),eastern_clock("4:00 PM","SSC")),
                         "4:00 PM ET")
        self.assertIsNone(eastern_clock("TBA","GLVC"))
        self.assertIsNone(eastern_clock("7:00 PM","GLVC"))

    def test_both_school_pages_required_and_finals_preserved(self):
        teams={key:{"id":key,"name":aliases[0],"conference":"Sunshine State"}
               for key,aliases in ALIASES["SSC"].items()}
        sources=SOURCES["SSC"]["men"]
        by_id={key:sid for sid,key in sources.items()}
        url_0=BASES["SSC"]+str(by_id["barry"])
        url_1=BASES["SSC"]+str(by_id["eckerd"])
        def fake_fetch(url):
            sid=int(url.split("=")[-1])
            owner=sources[sid]
            if owner=="barry":return fake_grid("Barry","Eckerd",home=True)
            if owner=="eckerd":return fake_grid("Eckerd","Barry",home=False)
            name=ALIASES["SSC"][owner][0]
            return fake_grid(name,"Barry",home=False)
        prior={"legacy-ncaa": {"id":"legacy-ncaa","date":"2026-11-18",
             "away":"eckerd","home":"barry","status":"final",
             "verified":True,"elo_eligible":True,"away_score":66,"home_score":77,
             "source_url":"https://www.ncaa.com/official"}}
        result=enrich("SSC","men",prior,teams,dt.date(2026,11,1),fake_fetch)
        self.assertEqual(result["schools_read"],11)
        self.assertEqual(result["enriched"],1)
        self.assertEqual(result["added"],7)
        self.assertEqual(len(prior),8)
        self.assertEqual(prior["legacy-ncaa"]["id"],"legacy-ncaa")
        self.assertEqual(prior["legacy-ncaa"]["away_score"],66)
        self.assertEqual(prior["legacy-ncaa"]["home_score"],77)
        self.assertEqual(prior["legacy-ncaa"]["source_url"],"https://www.ncaa.com/official")
        self.assertEqual(prior["legacy-ncaa"]["start_time"],"7:30 PM ET")
        self.assertTrue(all(len(g.get("official_schedule_sources") or [])==2 for g in prior.values()))
        self.assertTrue(all(g["away"]=="eckerd" and g["home"]=="barry" for g in prior.values()))
        second=enrich("SSC","men",prior,teams,dt.date(2026,11,1),fake_fetch)
        self.assertEqual(second["added"],0)
        self.assertEqual(len(prior),8)

    def test_one_school_or_wrong_direction_never_creates_fixtures(self):
        teams={key:{"id":key,"name":aliases[0],"conference":"Sunshine State"}
               for key,aliases in ALIASES["SSC"].items()}
        ids=SOURCES["SSC"]["men"]
        def only_single(url):
            return fake_grid(ALIASES["SSC"][ids[int(url.split("=")[-1])]][0],
                             "Eckerd" if not url.endswith("4703") else "Barry",home=True)
        games={}
        result=enrich("SSC","men",games,teams,dt.date(2026,11,1),only_single)
        self.assertEqual(result["added"],0)
        self.assertEqual(games,{})

if __name__=="__main__":
    unittest.main()

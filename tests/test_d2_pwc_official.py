"""PacWest 2026-27 dual-school source tests; never invent cross-gender dates or tipoffs."""
import datetime as dt
import unittest

from scripts.d2_pwc_official import ALIASES, SOURCES, BASES, parse, enrich_pwc, school

def grid(owner,opponent,gender="men",home=True,clock="7:30 P.M."):
    label="Men's" if gender=="men" else "Women's"
    rows="".join(
        f"<tr><td>12/{day}/2026</td><td>*</td><td>"+
        ("" if home else "at ")+opponent+
        f"</td><td>Published venue</td><td>{clock}</td></tr>"
        for day in range(2,10))
    return (f"<html><head><title>2026-27 {owner} {label} Basketball "
            f"- Schedule - The PacWest Conference</title></head><body>"
            "<table><thead><tr><th>DATE</th><th>CONF.</th>"
            "<th>OPPONENT</th><th>LOCATION</th><th>TIME/RESULT</th>"
            "</tr></thead><tbody>"+rows+"</tbody></table></body></html>")

class PacWestRecoveryTests(unittest.TestCase):
    def test_20_actual_school_sources_are_gender_isolated(self):
        self.assertEqual(len(SOURCES["PWC"]["men"]),10)
        self.assertEqual(len(SOURCES["PWC"]["women"]),10)
        self.assertFalse(set(SOURCES["PWC"]["men"]) & set(SOURCES["PWC"]["women"]))
        for gender in ("men","women"):
            self.assertEqual(set(SOURCES["PWC"][gender].values()),set(ALIASES["PWC"]))
        self.assertEqual(school("PWC","Point Loma Nazarene"),"pointloma")
        self.assertEqual(school("PWC","Hawai'i Pacific"),"pacific")
        self.assertIsNone(school("PWC","Azusa Pacific"))

    def test_exact_source_gender_season_and_unzoned_tipoff_is_withheld(self):
        rows,rejected=parse(grid("Point Loma","Biola"),"PWC","men",8230)
        self.assertEqual(len(rows),8)
        self.assertEqual(rows[0][1:4],("biola","pointloma","pointloma"))
        self.assertIsNone(rows[0][4]) # source does not identify ET, CT or PT
        for bad in (grid("Point Loma","Biola",gender="women"),
                    grid("Biola","Point Loma"),
                    grid("Point Loma","Biola").replace("2026-27","2025-26")):
            with self.assertRaises(ValueError):parse(bad,"PWC","men",8230)

    def test_neutral_or_unmatched_opponent_is_not_certified(self):
        for opponent in ("vs. Biola","Unlisted School"):
            with self.assertRaises(ValueError):
                parse(grid("Point Loma",opponent),"PWC","men",8230)

    def test_two_school_agreement_preserves_old_final_and_repeated_refresh(self):
        teams={key:{"id":key,"name":labels[0],"conference":"PacWest"}
               for key,labels in ALIASES["PWC"].items()}
        ids=SOURCES["PWC"]["men"]
        def fetch(url):
            owner=ids[int(url.split("=")[-1])]
            if owner=="pointloma":return grid("Point Loma","Biola")
            if owner=="biola":return grid("Biola","Point Loma",home=False)
            return grid(ALIASES["PWC"][owner][0],"Biola",home=False)
        games={"ncaa-verified": {"id":"ncaa-verified","date":"2026-12-02",
              "away":"biola","home":"pointloma","status":"final",
              "away_score":80,"home_score":88,"verified":True,"elo_eligible":True,
              "source_url":"https://www.ncaa.com/official"}}
        report=enrich_pwc("men",games,teams,dt.date(2026,11,1),fetch)
        self.assertEqual(report["schools_read"],10)
        self.assertEqual(report["added"],7)
        self.assertEqual(report["enriched"],1)
        self.assertEqual(len(games),8)
        self.assertEqual(games["ncaa-verified"]["away_score"],80)
        self.assertEqual(games["ncaa-verified"]["home_score"],88)
        self.assertEqual(games["ncaa-verified"]["source_url"],"https://www.ncaa.com/official")
        self.assertNotIn("start_time",games["ncaa-verified"])
        self.assertTrue(all(len(g["official_schedule_sources"])==2 for g in games.values()))
        second=enrich_pwc("men",games,teams,dt.date(2026,11,1),fetch)
        self.assertEqual(second["added"],0)

    def test_mismatched_homes_generate_no_fake_fixtures(self):
        teams={key:{"id":key,"name":labels[0],"conference":"PacWest"}
               for key,labels in ALIASES["PWC"].items()}
        sources=SOURCES["PWC"]["men"]
        def fake(url):
            owner=sources[int(url.split("=")[-1])]
            rival="Biola" if owner!="biola" else "Point Loma"
            return grid(ALIASES["PWC"][owner][0],rival,home=True)
        games={}
        result=enrich_pwc("men",games,teams,dt.date(2026,11,1),fake)
        self.assertEqual(result["added"],0)
        self.assertFalse(games)

if __name__=="__main__":unittest.main()

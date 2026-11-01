"""Offline safety tests for 2026-27 reciprocal RMAC official calendars."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from d2_rmac_official import SOURCES,parse,enrich_rmac,BASE

def html(gender,name,opponent,mark="*"):
    gender_title="Women's" if gender=="women" else "Men's"
    return (f"<html><title>2026-27 {name} {gender_title} Basketball - Rocky Mountain Athletic Conference</title>"
        "<table><thead><tr><th>Date</th><th>RMAC</th><th>Opponent</th><th>Location</th>"
        "<th>Time/Result</th></tr></thead><tbody>"
        f"<tr><td>12/3/2026</td><td>{mark}</td><td>{opponent}</td>"
        "<td>Alamosa, CO</td><td>7:00 P.M.</td></tr></tbody></table></html>")

def catalog(gender):
    # Twelve authentic source IDs have pages; only two reciprocate.
    ids=list(SOURCES[gender])[:12]
    first=next(k for k,v in SOURCES[gender].items() if v=="Adams State")
    other=next(k for k,v in SOURCES[gender].items() if v=="CSU Pueblo")
    result={}
    for sid in ids:
        name=SOURCES[gender][sid]
        op=("CSU Pueblo" if sid==first else
            "at Adams State University" if sid==other else
            "at Adams State University")
        result[BASE+str(sid)]=html(gender,name,op)
    return result

def teams():
    from d2_rmac_official import ALIAS
    return {k:{"name":labels[0],"conference":"RMAC"} for k,labels in ALIAS.items()}

class TestRmac(unittest.TestCase):
    def test_source_ids_distinct_and_gender_isolated(self):
        self.assertEqual(len(SOURCES["men"]),15)
        self.assertEqual(len(SOURCES["women"]),15)
        self.assertFalse(set(SOURCES["men"]) & set(SOURCES["women"]))
        women_id=next(iter(SOURCES["women"]))
        with self.assertRaises(ValueError):
            parse(html("men",SOURCES["women"][women_id],"at Regis"),
                  "women",women_id)
    def test_reject_wrong_gender_and_neutral_and_nonconference(self):
        sid=next(iter(SOURCES["men"]));name=SOURCES["men"][sid]
        with self.assertRaises(ValueError):
            parse(html("women",name,"at CSU Pueblo"),"men",sid)
        with self.assertRaises(ValueError):
            parse(html("men",name,"vs. CSU Pueblo"),"men",sid)
        with self.assertRaises(ValueError):
            parse(html("men",name,"at CSU Pueblo",mark=""),"men",sid)
    def test_publish_only_reciprocal_and_preserve_current_ids(self):
        src=catalog("men")
        def read(url):return src[url]
        games={}
        result=enrich_rmac("men",games,teams(),dt.date(2026,11,1),read)
        self.assertEqual(result["added"],1,result)
        self.assertEqual(len(games),1)
        game=next(iter(games.values()))
        self.assertEqual((game["away"],game["home"]),("pueblo","adams"))
        self.assertEqual(len(game["official_schedule_sources"]),2)
        self.assertNotIn("start_time",game)
        self.assertNotIn("venue",game)
        self.assertNotIn("network",game)
        game["status"]="final";game["away_score"]=82;game["home_score"]=71
        again=enrich_rmac("men",games,teams(),dt.date(2026,11,1),read)
        self.assertEqual(again["added"],0)
        self.assertEqual(game["status"],"final")
        self.assertEqual(game["away_score"],82)
    def test_withhold_if_less_than_twelve_sources(self):
        src=catalog("women")
        valid=dict(list(src.items())[:11])
        out={};audit=enrich_rmac("women",out,teams(),dt.date(2026,11,1),lambda u: valid[u])
        self.assertEqual(out,{})
        self.assertIn("held",audit["status"])
    def test_withhold_uncorroborated_home_conflict(self):
        src=catalog("men")
        first=next(k for k,v in SOURCES["men"].items() if v=="Adams State")
        # Both institutions now say they are hosting: no matching away/home pair.
        src[BASE+str(first)]=html("men","Adams State","at CSU Pueblo")
        out={};audit=enrich_rmac("men",out,teams(),dt.date(2026,11,1),lambda u:src[u])
        self.assertEqual(out,{})
        self.assertGreater(audit["one_sided"],0)
if __name__=="__main__":unittest.main()

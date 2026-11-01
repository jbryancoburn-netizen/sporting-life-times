import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("d2_brand",ROOT/"scripts"/"build_d2_basketball.py")
builder=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)

class D2ESPNBrandingTests(unittest.TestCase):
    def make_espn_payload(self):
        entries=[
            {"team":{"id":"1001","location":"Adams State","displayName":"Adams State Grizzlies",
                     "color":"00205b","alternateColor":"ffba00"}},
            {"team":{"id":"1002","location":"Adelphi","displayName":"Adelphi Panthers",
                     "color":"113379","alternateColor":"ffffff"}},
            {"team":{"id":"1003","location":"Different School","displayName":"Different School Goats",
                     "color":"ff3344","alternateColor":"99ff11"}},
        ]
        entries.extend({"team":{"id":str(i),"location":"Extra School "+str(i),"color":"003300",
                                  "alternateColor":"888888"}} for i in range(30))
        return {"sports":[{"leagues":[{"teams":entries}]}]}

    def test_only_exact_dii_names_get_espn_colors(self):
        teams={
            "adams-state":{"name":"Adams State","slug":"adams-st"},
            "adelphi-university":{"name":"Adelphi University","slug":"adelphi"},
            "ambiguous":{"name":"Other School","slug":""},
        }
        with patch.object(builder,"get_json",return_value=self.make_espn_payload()) as m:
            coverage=builder.seed_espn_dii_branding("women",teams)
        self.assertIn("group=51",m.call_args.args[0])
        self.assertEqual(coverage["matched"],2)
        self.assertEqual(coverage["official_secondary"],1)
        self.assertEqual(coverage["editorial_tonal_secondary"],1)
        self.assertEqual(teams["adams-state"]["primary"],"#00205b")
        self.assertEqual(teams["adams-state"]["secondary"],"#ffba00")
        self.assertEqual(teams["adelphi-university"]["primary"],"#113379")
        self.assertNotEqual(teams["adelphi-university"]["secondary"],"#ffffff")
        self.assertIn("editorial",teams["adelphi-university"]["color_provenance"])
        self.assertNotIn("primary",teams["ambiguous"])

    def test_incomplete_provider_does_not_erase_existing_branding(self):
        teams={"adams-state":{"name":"Adams State","primary":"#112233","secondary":"#aabbcc"}}
        with patch.object(builder,"get_json",return_value={"teams":[]}):
            result=builder.seed_espn_dii_branding("men",teams)
        self.assertEqual(result["directory_teams"],0)
        self.assertEqual(teams["adams-state"]["primary"],"#112233")

    def test_share_only_identical_ncaa_school_logo_slug(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"d2-men-2026-27.json"
            p.write_text(json.dumps({"teams":[{"name":"Adams State","slug":"adams-st",
                "primary":"#00205b","secondary":"#ffba00","color_source":"ESPN Division II"}]}))
            target={
                "correct":{"name":"Adams State University","slug":"adams-st"},
                "wrong":{"name":"Adams State Different School","slug":"other-school"}
            }
            with patch.object(builder,"DATA",Path(td)):
                result=builder.seed_shared_dii_colors("women",target)
            self.assertEqual(result["added"],1)
            self.assertEqual(target["correct"]["secondary"],"#ffba00")
            self.assertNotIn("secondary",target["wrong"])

    def test_reject_362_school_directory_before_wrong_color_assignments(self):
        fake={"teams":[{"team":{"id":str(i),"location":"School "+str(i),
            "color":"ff0000","alternateColor":"000000"}} for i in range(362)]}
        with patch.object(builder,"get_json",return_value=fake):
            schools={"charleston":{"name":"Charleston","slug":""}}
            response=builder.seed_espn_dii_branding("men",schools)
        self.assertIn("unverified",response["error"])
        self.assertNotIn("primary",schools["charleston"])

    def test_published_dii_palette_provenance_and_no_white_decorative_ring(self):
        import tempfile
        evidence={"entries":[
            {"gender_ids":{"women":"chaminade-university"},"primary":"#0054A5",
             "secondary":"#D9D9D6","secondary_kind":"published","source_url":"https://teamcolorcodes.com/chaminade-silverswords-color-codes/"},
            {"gender_ids":{"women":"texas-woman-s-university"},"primary":"#850928",
             "secondary":"#FFFFFF","secondary_kind":"white_replaced_with_tonal",
             "source_url":"https://teamcolorcodes.com/texas-womans-pioneers-color-codes/"}]}
        with tempfile.TemporaryDirectory() as d:
            (Path(d)/"d2-school-color-evidence-2026.json").write_text(json.dumps(evidence))
            teams={"chaminade-university":{"name":"Chaminade University"},
                   "texas-woman-s-university":{"name":"Texas Woman's University"}}
            with patch.object(builder,"DATA",Path(d)):
                result=builder.seed_published_dii_palettes("women",teams)
        self.assertEqual(result["matched"],2)
        self.assertEqual(result["tonal_accents"],1)
        self.assertEqual(teams["chaminade-university"]["secondary"],"#d9d9d6")
        self.assertNotEqual(teams["texas-woman-s-university"]["secondary"],"#ffffff")
        self.assertIn("editorial",teams["texas-woman-s-university"]["color_provenance"])

if __name__=="__main__":
    unittest.main()

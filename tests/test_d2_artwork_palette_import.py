import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("d2_builder_artwork",ROOT/"scripts"/"build_d2_basketball.py")
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class NCAAArtworkPaletteTests(unittest.TestCase):
    def test_uses_only_matching_ncaa_svg_artwork_without_overriding_official_colors(self):
        report={
            "kind":"candidates only; not published verified team palettes",
            "entries":{
                "nova-southeastern":{
                    "source_url":"https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/nova-southeastern.svg",
                    "primary":"#002e67","secondary":"#f1bd20",
                    "top_colors":[["#002e67",110],["#f1bd20",52]]
                },
                "untrusted":{
                    "source_url":"https://thirdparty.invalid/logo/untrusted.svg",
                    "primary":"#1032ad","secondary":"#ecb820",
                    "top_colors":[["#1032ad",44],["#ecb820",28]]
                }
            }
        }
        with tempfile.TemporaryDirectory() as d:
            Path(d,"d2-ncaa-logo-artwork-palette-audit.json").write_text(json.dumps(report))
            teams={
                "a":{"slug":"nova-southeastern","name":"Nova Southeastern"},
                "b":{"slug":"nova-southeastern","name":"Nova Southeastern women",
                     "primary":"#b60230","secondary":"#eeeeaa","color_provenance":"Official guide"},
                "c":{"slug":"untrusted","name":"Fake School"},
                "d":{"slug":"","name":"Unknown"}
            }
            with patch.object(builder,"DATA",Path(d)):
                quality=builder.seed_logo_artwork_palettes(teams)
        self.assertEqual(quality["matched"],1)
        self.assertTrue(quality["not_university_brand_colors"])
        self.assertEqual(teams["a"]["primary"],"#002e67")
        self.assertEqual(teams["a"]["secondary"],"#f1bd20")
        self.assertIn("not independently certified",teams["a"]["color_provenance"])
        self.assertEqual(teams["b"]["primary"],"#b60230")
        self.assertNotIn("primary",teams["c"])
        self.assertNotIn("primary",teams["d"])

    def test_empty_or_missing_evidence_preserves_neutral_logo_bands(self):
        with tempfile.TemporaryDirectory() as d:
            teams={"x":{"slug":"random","name":"Random"}}
            with patch.object(builder,"DATA",Path(d)):
                q=builder.seed_logo_artwork_palettes(teams)
            self.assertEqual(q["matched"],0)
            self.assertNotIn("primary",teams["x"])

if __name__=="__main__":
    unittest.main()

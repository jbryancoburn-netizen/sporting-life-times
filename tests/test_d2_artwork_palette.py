import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location(
 "d2_logo_palette",Path(__file__).resolve().parents[1]/"scripts"/"build_d2_basketball.py")
builder=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)

class D2ArtworkPaletteTests(unittest.TestCase):
 def test_colorful_ncaa_svg_has_two_real_nonwhite_logo_colors(self):
  svg='<svg xmlns="http://www.w3.org/2000/svg"><path fill="#0054A5"/><path fill="#0054A5"/><path fill="#D9D9D6"/><rect fill="#ffffff"/></svg>'
  c=builder.extract_logo_artwork_colors(svg)
  self.assertIsNotNone(c)
  self.assertEqual(c["primary"],"#0054a5")
  self.assertEqual(c["secondary"],"#d9d9d6")
  self.assertNotIn("#ffffff",[c["primary"],c["secondary"]])

 def test_monochrome_logo_does_not_get_fake_school_colors(self):
  self.assertIsNone(builder.extract_logo_artwork_colors('<svg><path fill="#000000"/><rect fill="#fff"/></svg>'))

 def test_cached_logo_palette_shared_between_gendered_schools(self):
  svg='<svg><path fill="#0054A5"/><path fill="#0054A5"/><path fill="#D9D9D6"/><rect fill="#FFFFFF"/></svg>'
  with tempfile.TemporaryDirectory() as d:
   teams={"x":{"name":"Chaminade","slug":"chaminade"}}
   with patch.object(builder,"DATA",Path(d)),patch.object(builder,"get_logo_svg",return_value=svg) as fetch:
    audit=builder.seed_logo_artwork_palette(teams)
    self.assertEqual(audit["matched"],1)
    self.assertEqual(fetch.call_count,1)
   self.assertTrue((Path(d)/"d2-logo-artwork-palette-2026.json").exists())
   other={"y":{"name":"Chaminade University","slug":"chaminade"}}
   with patch.object(builder,"DATA",Path(d)),patch.object(builder,"get_logo_svg",side_effect=RuntimeError("network disabled")) as fetch:
    audit=builder.seed_logo_artwork_palette(other)
    self.assertEqual(audit["matched"],1)
    self.assertEqual(fetch.call_count,0)
   self.assertEqual(other["y"]["primary"],teams["x"]["primary"])
   self.assertEqual(other["y"]["secondary"],teams["x"]["secondary"])

if __name__=="__main__":
 unittest.main()

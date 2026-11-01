import importlib.util
import unittest
from pathlib import Path

SOURCE=Path(__file__).resolve().parents[1]/"scripts"/"audit_d2_svg_palette.py"
spec=importlib.util.spec_from_file_location("d2_svg_palette",SOURCE)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ArtworkPaletteTests(unittest.TestCase):
    def test_literal_svg_artwork_has_two_distinct_nonwhite_colors(self):
        svg='<svg xmlns="http://www.w3.org/2000/svg">'
        svg+='<path fill="#002D62" d="M0 0 L3 3"/>'
        svg+='<path fill="#002D62" d="M3 3 L5 5"/>'
        svg+='<rect fill="#FFC72C" width="20" height="20"/>'
        svg+='<circle fill="#FFC72C" r="9"/>'
        svg+='</svg>'
        a=m.from_svg(svg)
        self.assertEqual(a["primary"],"#002d62")
        self.assertEqual(a["secondary"],"#ffc72c")
        self.assertIn("not institutional",a["method"])

    def test_css_classes_and_white_background_ignored(self):
        svg='<svg xmlns="http://www.w3.org/2000/svg">'
        svg+='<style>.blue{fill:#1265AA}.gold{fill:#FFCA22}</style>'
        svg+='<rect fill="#FFFFFF"/>'
        svg+='<path class="blue"/><path class="blue"/>'
        svg+='<path class="gold"/><path class="gold"/>'
        svg+='</svg>'
        a=m.from_svg(svg)
        self.assertEqual(set([a["primary"],a["secondary"]]),set(["#1265aa","#ffca22"]))
        self.assertNotIn("#ffffff",dict(a["top_colors"]))

    def test_monochrome_and_external_entities_are_quarantined(self):
        self.assertIn("error",m.from_svg('<svg><path fill="#003366"/></svg>'))
        self.assertIn("error",m.from_svg('<!DOCTYPE svg [<!ENTITY x "bad">]><svg/>'))
        self.assertIsNone(m.canonical("#FFFFFF"))

if __name__=="__main__":
    unittest.main()

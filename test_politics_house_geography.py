"""Regression checks: real 2026 state polygons must link to exactly 435 House seats."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class CongressionalMapGeography(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.atlas = json.loads((ROOT / "politics-house-atlas.json").read_text(encoding="utf-8"))
        cls.directory = ROOT / "politics-geometry"

    def test_all_50_states_have_correct_official_congressional_shapes(self):
        self.assertEqual(len(self.atlas["states"]), 50)
        seen = set()
        for state in self.atlas["states"]:
            code = state["code"]
            data = json.loads((self.directory / f"{code}.geojson").read_text(encoding="utf-8"))
            field = "CD119" if code == "MO" else "CD120"
            self.assertEqual(data["type"], "FeatureCollection")
            self.assertEqual(data["meta"]["state"], code)
            self.assertEqual(data["meta"]["field"], field)
            self.assertEqual(data["meta"]["layer"], 4 if code == "MO" else 0)
            self.assertIn("tigerweb.geo.census.gov", data["meta"]["source_url"])
            actual_ids = {code + "-" + str(f["properties"][field]).zfill(2)
                          for f in data["features"]}
            self.assertEqual(len(actual_ids), len(data["features"]), code)
            self.assertEqual(actual_ids, set(state["district_ids"]), code)
            self.assertEqual(len(data["features"]), state["district_count"], code)
            for feature in data["features"]:
                self.assertIn(feature["geometry"]["type"], {"Polygon", "MultiPolygon"})
                self.assertTrue(feature["geometry"]["coordinates"])
                self.assertNotIn("2026_forecast", feature["properties"])
                self.assertNotIn("win_probability", feature["properties"])
            seen.update(actual_ids)
        self.assertEqual(len(seen), 435)
        self.assertEqual(seen, {r["id"] for r in self.atlas["districts"]})

    def test_map_interface_exposes_clickable_geographic_state_and_fallback(self):
        html = (ROOT / "politics-house-state.html").read_text(encoding="utf-8")
        js = (ROOT / "politics-house-map.js").read_text(encoding="utf-8")
        style = (ROOT / "politics-house.css").read_text(encoding="utf-8")
        self.assertIn('id="geo-district-map"', html)
        self.assertIn('id="map-district-jump"', html)
        self.assertIn('id="map-fallback"', html)
        self.assertIn("politics-house-map.js", html)
        self.assertIn("leaflet@1.9.4", html)
        self.assertIn("layer", js)
        self.assertIn('shape.on("click"', js)
        self.assertIn('event.key==="Enter"', js)
        self.assertIn("politics-geometry/", js)
        self.assertIn('code==="MO"', js)
        self.assertIn('f.properties?.[field]!=="ZZ"', js)
        self.assertIn(".geo-district-map", style)

    def test_2026_geography_has_no_invented_predictions(self):
        self.assertFalse(self.atlas["forecast_eligible"])
        self.assertEqual(self.atlas["certified_2026_probabilities"], 0)
        for district in self.atlas["districts"]:
            self.assertIsNone(district["2026_forecast"])


if __name__ == "__main__":
    unittest.main()

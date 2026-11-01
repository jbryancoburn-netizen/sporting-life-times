"""Keep the 2026 congressional state desk map-first and small-screen usable.

The test uses only Python's HTML parser; no paid browser, API or data source.
"""
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class DOM(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids={}
        self.start=[]
        self.stack=[]
        self.details=[]
        self.metrics=0
        self.mapping={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:raise AssertionError("Duplicate ID "+a["id"])
            self.ids[a["id"]]=len(self.start)
        if tag=="details":self.details.append(a)
        if tag=="div" and "metric" in a.get("class","").split():self.metrics+=1
        self.start.append((tag,a))
        self.stack.append(tag)
    def handle_endtag(self,tag):
        if tag in self.stack:
            i=len(self.stack)-1-self.stack[::-1].index(tag)
            self.stack=self.stack[:i]

class StateEdition(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=(ROOT/"politics-house-state.html").read_text(encoding="utf-8")
        cls.js=(ROOT/"politics-house.js").read_text(encoding="utf-8")
        cls.css=(ROOT/"politics-house.css").read_text(encoding="utf-8")
        cls.dom=DOM();cls.dom.feed(cls.html)

    def test_map_and_races_appear_before_full_coverage_notes(self):
        ids=self.dom.ids
        self.assertLess(ids["state-title"],ids["metrics"])
        self.assertLess(ids["metrics"],ids["district-geography"])
        self.assertLess(ids["district-geography"],ids["district-list"])
        self.assertLess(ids["district-list"],ids["coverage-section"])
        self.assertEqual(self.dom.metrics,3)
        self.assertNotIn("UNCHANGED</b>",self.html)
        self.assertIn('id="state-map-status-pill"',self.html)

    def test_source_notes_are_progressively_disclosed(self):
        self.assertIn('<details class="state-sources-details" id="coverage-section">',self.html)
        self.assertIn('<details class="state-sources-details"><summary>',self.html)
        self.assertEqual(len(self.dom.details),2)
        self.assertTrue(all("open" not in d for d in self.dom.details))
        self.assertIn('id="coverage-board"',self.html)
        self.assertIn('id="district-map-status"',self.html)
        self.assertIn('id="geo-district-map"',self.html)

    def test_mobile_rules_and_keyboard_safe_direct_links(self):
        self.assertIn('body[data-house-page="state"] .state-feature-map',self.css)
        self.assertIn('body[data-house-page="state"] .state-metrics',self.css)
        self.assertIn('@media (max-width:720px)',self.css)
        self.assertIn('grid-template-columns:repeat(3,minmax(0,1fr))',self.css)
        self.assertIn('body[data-house-page="state"] .state-sources-details',self.css)
        self.assertIn('href="#district-geography"',self.html)
        self.assertIn('href="#district-list"',self.html)
        self.assertIn('id="district-filter"',self.html)
        self.assertIn('id="map-district-jump"',self.html)
        self.assertIn('id="map-open-district"',self.html)
        self.assertNotIn('$("state-back")',self.js)

    def test_state_edition_is_data_driven_and_history_is_not_a_forecast(self):
        self.assertIn('state["2026_verified_house_nominee_offices"]',self.js)
        self.assertIn('state["2026_house_poll_count"]',self.js)
        self.assertIn('state["2026_congressional_map_changed"]',self.js)
        self.assertIn('pres.dem_margin_pp',self.js)
        self.assertIn('2026 map · redrawn',self.js)
        self.assertIn('2026 map · unchanged',self.js)
        self.assertIn("color(info.party,info.margin)",(ROOT/"politics-house-map.js").read_text(encoding="utf-8"))
        self.assertIn('not forecasts',(ROOT/"politics-house-map.js").read_text(encoding="utf-8").lower())

if __name__=="__main__":
    unittest.main()

"""Check all static political House entrypoints and 435 district links on GitHub Pages."""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote

ROOT=Path(__file__).resolve().parent
class Tags(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=set();self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:raise AssertionError("Duplicate DOM ID "+a["id"])
            self.ids.add(a["id"])
        if tag=="a" and "href" in a:self.links.append(a["href"])

def read_html(path):
    parser=Tags()
    parser.feed((ROOT/path).read_text(encoding="utf-8"))
    return parser

class HouseUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a=json.loads((ROOT/"politics-house-atlas.json").read_text())

    def test_all_435_are_deep_linkable_into_one_validated_template(self):
        self.assertEqual(self.a["district_count"],435)
        ids={d["id"] for d in self.a["districts"]}
        self.assertEqual(len(ids),435)
        self.assertTrue(all(re.fullmatch(r"[A-Z]{2}-\d{2}",x) for x in ids))
        urls={"politics-house-district.html?district="+quote(i) for i in ids}
        self.assertEqual(len(urls),435)
        self.assertEqual(sum(s["district_count"] for s in self.a["states"]),435)

    def test_all_50_state_urls_unique_and_annotated(self):
        states=self.a["states"]
        self.assertEqual(len({s["code"] for s in states}),50)
        for s in states:
            self.assertIn("2024_presidential_actual",s)
            self.assertTrue(-100<=s["2024_presidential_actual"]["dem_margin_pp"]<=100)
            self.assertTrue(all(rid in {r["id"] for r in self.a["districts"]} for rid in s["district_ids"]))

    def test_every_page_has_critical_referenced_nodes(self):
        cases={
            "politics-house.html":["view-content","metrics","state-tiles","state-list","state-search","atlas-updated"],
            "politics-house-state.html":["view-content","state-title","state-desc","state-history","metrics","district-cards","district-filter","district-count","boundary-caution","district-geo-map","geometry-hover","geometry-vintage","geo-zoom-in","geo-zoom-out","geo-zoom-reset"],
            "politics-house-district.html":["view-content","district-title","district-subtitle","metrics","candidate-panel","poll-panel","result-panel","map-warning","prev-district","next-district","leader-badge","district-updated","state-link"]
        }
        for p,ids in cases.items():
            with self.subTest(page=p):
                dom=read_html(p)
                self.assertTrue(set(ids).issubset(dom.ids))
                html=(ROOT/p).read_text()
                self.assertIn('politics-house.js?',html)
                self.assertIn('politics-house.css?',html)

    def test_census_map_scripts_linked_on_state_pages(self):
        html=(ROOT/"politics-house-state.html").read_text(encoding="utf-8")
        self.assertIn('politics-house-geomap.js?',html)
        js=(ROOT/"politics-house.js").read_text(encoding="utf-8")
        self.assertIn("PoliticalHouseGeoMap.render",js)
        svg=(ROOT/"politics-house-geomap.js").read_text(encoding="utf-8")
        self.assertIn("district-geo-map",svg)
        self.assertIn("MISSOURI",svg.upper())
        self.assertIn("politics-house-district.html?district=",svg)

    def test_election_home_navigation_wired(self):
        dom=read_html("politics.html")
        self.assertIn("show-house",dom.ids)
        self.assertIn("show-senate",dom.ids)
        self.assertIn("show-governors",dom.ids)
        self.assertTrue(any(l=="politics-house.html" for l in dom.links))

    def test_no_inferred_probabilities_or_stale_map_district_shading(self):
        a=self.a
        self.assertFalse(a["forecast_eligible"])
        self.assertEqual(a["certified_2026_probabilities"],0)
        for r in a["districts"]:
            self.assertIsNone(r["2026_forecast"])
            if r["2026_boundaries_revised"] and r["2024_house_result_on_prior_boundaries"]:
                self.assertFalse(r["2024_house_result_on_prior_boundaries"]["same_2026_geography"])
if __name__=="__main__":unittest.main()

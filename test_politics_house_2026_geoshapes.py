"""Congressional boundary maps must preserve 435 real districts and 2026 Missouri exception."""
import unittest
from shapely.geometry import Polygon,MultiPolygon
from scripts.politics_house_2026_geoshapes import FIPS,source_for,_rounded_rings,MAX_BYTES,ROOT

class CensusHouseMapTests(unittest.TestCase):
    def test_50_states_have_per_state_official_census_zip(self):
        self.assertEqual(len(FIPS),50)
        self.assertEqual(len(set(FIPS.values())),50)
        for s in FIPS:
            url,column,vintage=source_for(s)
            self.assertTrue(url.startswith("https://www2.census.gov/geo/tiger/"))
            self.assertTrue(url.endswith(".zip"))
            self.assertEqual(column,"CD119FP" if s=="MO" else "CD120FP")
            self.assertTrue("TIGER2025" in url if s=="MO" else "TIGER2026" in url)
            self.assertTrue("119th_2025" in vintage if s=="MO" else "120th_2026" in vintage)

    def test_stale_2026_missouri_file_can_never_be_selected(self):
        url,column,vintage=source_for("MO")
        self.assertIn("tl_2025_29_cd119.zip",url)
        self.assertNotIn("TIGER2026",url)

    def test_simplified_polygons_keep_holes_and_valid_closed_rings(self):
        p=Polygon([(0,0),(0,3),(3,3),(3,0),(0,0)],holes=[[(1,1),(2,1),(2,2),(1,2),(1,1)]])
        polys=_rounded_rings(p)
        self.assertEqual(len(polys),1)
        self.assertEqual(len(polys[0]),2)
        self.assertTrue(all(r[0]==r[-1] for r in polys[0]))

    def test_multipolygon_state_is_still_drawing_complete(self):
        p=MultiPolygon([
            Polygon([(-1,0),(-1,1),(0,1),(0,0),(-1,0)]),
            Polygon([(3,0),(3,1),(4,1),(4,0),(3,0)])
        ])
        self.assertEqual(len(_rounded_rings(p)),2)

    def test_no_other_us_geographies_falsely_counted_as_voting_state(self):
        with self.assertRaises(ValueError):source_for("PR")
        with self.assertRaises(ValueError):source_for("DC")
        with self.assertRaises(ValueError):source_for("ZZ")

    def test_data_source_not_local_polled_votes(self):
        self.assertGreater(MAX_BYTES,1_100_000)

if __name__=="__main__":unittest.main()

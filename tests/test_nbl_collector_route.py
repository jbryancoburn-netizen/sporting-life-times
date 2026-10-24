import unittest
from pathlib import Path

class NBLCollectorRouteTest(unittest.TestCase):
    def test_correct_espn_nbl_route(self):
        source=Path("scripts/collect_scores.py").read_text()
        self.assertIn('("Australian NBL","basketball/nbl")',source)
        self.assertNotIn('basketball/aus.nbl',source)
if __name__=="__main__": unittest.main()

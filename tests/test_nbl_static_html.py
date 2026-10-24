import unittest
from scripts.embed_nbl_ratings import render
class TestVisibleNBLResearchElo(unittest.TestCase):
    def model(self):
        teams=["Adelaide 36ers","Brisbane Bullets","Cairns Taipans","Illawarra Hawks",
               "Melbourne United","New Zealand Breakers","Perth Wildcats",
               "South East Melbourne Phoenix","Sydney Kings","Tasmania JackJumpers"]
        return {"status":"RESEARCH_ONLY_UNCERTIFIED","production_approved":False,
                "prediction_certified":False,"current_regular_season_games":41,
                "ratings":[{"rank":i,"team":t,"elo":1500+i,"wins":2,"losses":2}
                           for i,t in enumerate(teams,1)]}
    def test_all_ten_clubs_visible_without_js(self):
        output=render('<main><div id="nbl-elo-table"></div></main>',self.model())
        self.assertIn('data-nbl-static-elo="ready"',output)
        self.assertIn('Sydney Kings',output)
        self.assertEqual(output.count('<tr>'),11)
    def test_dont_publish_certified_prediction_claim(self):
        d=self.model();d["prediction_certified"]=True
        with self.assertRaises(ValueError):render('<div id="nbl-elo-table"></div>',d)
    def test_no_silent_missing_element(self):
        with self.assertRaises(ValueError):render('<main></main>',self.model())
if __name__=="__main__":unittest.main()

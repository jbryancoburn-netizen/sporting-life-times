"""Regression tests for EuroLeague per-game Header adapter."""
import unittest
import euroleague_header as header

class HeaderTests(unittest.TestCase):
    def payload(self, **kwargs):
        return dict({"CodeTeamA":"OLY ","CodeTeamB":"ULK ","Live":True,
                "ScoreA":"55","ScoreB":"49","Quarter":"3","RemainingPartialTime":"04:12"},**kwargs)
    def test_true_live_scores(self):
        item=header.details(self.payload(),"OLY","ULK","scheduled")
        self.assertEqual(item["state"],"live")
        self.assertEqual((item["home"],item["away"]),(55,49))
        self.assertIn("04:12",item["detail"])
    def test_identity_guard(self):
        self.assertIsNone(header.details(self.payload(),"OLY","BAR","scheduled"))
    def test_not_live_is_not_final(self):
        self.assertIsNone(header.details(self.payload(Live=False),"OLY","ULK","scheduled"))
    def test_no_fake_score(self):
        self.assertIsNone(header.details(self.payload(ScoreA=""),"OLY","ULK","scheduled"))
    def test_not_live_final_from_completed_season(self):
        self.assertEqual(header.details(self.payload(Live=False),"OLY","ULK","final")["state"],"final")
if __name__=="__main__":unittest.main()

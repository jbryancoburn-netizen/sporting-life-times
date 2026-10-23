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
    def test_confirm_completed_fourth_quarter(self):
        report=self.payload(Live=False,ScoreA="61",ScoreB="64",
            ScoreQuarter4A="61",ScoreQuarter4B="64",
            RemainingPartialTime="00:00")
        final=header.completed_score(report,"OLY","ULK",125)
        self.assertEqual(final["home"],61)
        self.assertEqual(final["away"],64)
    def test_no_final_from_false_live_flag_alone(self):
        report=self.payload(Live=False,ScoreA="34",ScoreB="24")
        self.assertIsNone(header.completed_score(report,"OLY","ULK",200))
    def test_no_final_before_fourth_quarter_completion(self):
        report=self.payload(Live=False,ScoreA="59",ScoreB="58",
            ScoreQuarter4A="61",ScoreQuarter4B="64")
        self.assertIsNone(header.completed_score(report,"OLY","ULK",95))
    def test_no_final_if_game_is_too_early(self):
        report=self.payload(Live=False,ScoreA="61",ScoreB="64",
            ScoreQuarter4A="61",ScoreQuarter4B="64")
        self.assertIsNone(header.completed_score(report,"OLY","ULK",35))
    def test_club_match_required_for_final(self):
        report=self.payload(Live=False,ScoreA="61",ScoreB="64",
            ScoreQuarter4A="61",ScoreQuarter4B="64")
        self.assertIsNone(header.completed_score(report,"OLY","BAR",125))
if __name__=="__main__":unittest.main()

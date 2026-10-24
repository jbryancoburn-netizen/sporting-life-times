import unittest
from build_ncaam_player_multistat_shadow import aggregate
class Multistat(unittest.TestCase):
    def setup_data(self):
        cross={"links":[{"id":"55","pid":"102","prior":"ncaa:9","method":"name_jersey"}]}
        roster={"teams":[{"team_id":"ncaa:10","players":[{"current_id":"55","prior_school_id":"ncaa:9"}]}]}
        box=[{"team_ncaa_team_id":"9","player_id":"102","contest_id":"g1","mins":"25","pts":"12","reb":"8","ast":"4","to":"2","stl":"1","blk":"1"}]
        return box,cross,roster
    def test_complete_box(self):
        x=aggregate(*self.setup_data())
        self.assertEqual(x["linked_athletes"],1)
        self.assertEqual(x["players"][0]["totals"]["assists"],4)
        self.assertEqual(x["players"][0]["totals"]["rebounds"],8)
    def test_actual_sportsdataverse_rebound_and_turnover_fields(self):
        box,cross,roster=self.setup_data()
        box[0].pop("reb")
        box[0].pop("to")
        box[0].update({"orb":"3","drb":"5","tov":"2"})
        values=aggregate(box,cross,roster)["players"][0]["totals"]
        self.assertEqual(values["offensive_rebounds"],3)
        self.assertEqual(values["defensive_rebounds"],5)
        self.assertEqual(values["rebounds"],8)
        self.assertEqual(values["turnovers"],2)
    def test_missing_stat_is_not_zero(self):
        box,cross,roster=self.setup_data()
        box[0].pop("stl")
        result=aggregate(box,cross,roster)["players"][0]
        self.assertIsNone(result["totals"]["steals"])
        self.assertFalse(result["complete_game_stat_coverage"]["steals"])
    def test_source_school_mismatch_is_excluded(self):
        box,cross,roster=self.setup_data()
        box[0]["team_ncaa_team_id"]="8"
        self.assertEqual(aggregate(box,cross,roster)["linked_athletes"],0)
    def test_duplicate_game_rejected(self):
        box,cross,roster=self.setup_data()
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            aggregate(box+box,cross,roster)
if __name__=="__main__":unittest.main()

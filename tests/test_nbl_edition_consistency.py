import unittest
from scripts.check_nbl_edition_consistency import verify

class NBLEditionConsistencyTests(unittest.TestCase):
    def fixtures(self):
        clubs=[f"Club {i}" for i in range(10)]
        er=[{"team":t,"elo":1500+i,"wins":1 if i==0 else 0,"losses":1 if i==1 else 0} for i,t in enumerate(clubs)]
        sr=[{"team":r["team"],"wins":r["wins"],"losses":r["losses"]} for r in er]
        return ({"status":"RESEARCH_ONLY_UNCERTIFIED","prediction_certified":False,
                 "current_regular_season_games":1,"ratings":er,"recent_results":[{"id":"1"}]},
                {"status":"source_derived_not_officially_reconciled","games_replayed":1,"rows":sr})
    def test_approved_release_requires_same_records(self):
        e,s=self.fixtures()
        self.assertTrue(verify(e,s)["records_reconciled"])
    def test_record_divergence_blocks_release(self):
        e,s=self.fixtures()
        s["rows"][0]["wins"]=0
        with self.assertRaises(ValueError):verify(e,s)
    def test_different_game_cutoffs_block_release(self):
        e,s=self.fixtures()
        s["games_replayed"]=2
        with self.assertRaises(ValueError):verify(e,s)
if __name__=="__main__":unittest.main()

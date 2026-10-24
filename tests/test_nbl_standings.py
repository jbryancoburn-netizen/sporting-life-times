import unittest
from scripts.publish_nbl_standings import build

class NBLStandingsTests(unittest.TestCase):
    def game(self,gid,when,home="Sydney Kings",away="Perth Wildcats",hs=91,aws=78):
        return {"id":gid,"played_at":when,"home":home,"away":away,
                "home_score":hs,"away_score":aws,"verified":False,"state":"candidate"}
    def test_excludes_blitz_and_uses_only_regular_season(self):
        d=build({"status":"uncertified_source_candidates","games":[
          self.game("pre","2026-09-02T07:30Z"),
          self.game("regular","2026-09-19T09:30Z")]})
        self.assertEqual(d["games_replayed"],1)
        rows={r["team"]:r for r in d["rows"]}
        self.assertEqual((rows["Sydney Kings"]["wins"],rows["Perth Wildcats"]["losses"]),(1,1))
        self.assertEqual(sum(r["wins"] for r in d["rows"]),1)
        self.assertFalse(d["is_official"])
        self.assertFalse(d["elo_approved"])
    def test_deduplicated_and_team_registry_enforced(self):
        g=self.game("one","2026-09-19T09:30Z")
        with self.assertRaises(ValueError):
            build({"status":"uncertified_source_candidates","games":[g,g]})
        g["away"]="Unknown Club"
        with self.assertRaises(ValueError):
            build({"status":"uncertified_source_candidates","games":[g]})
    def test_equal_record_uses_points_percentage_tiebreak(self):
        # Both teams finish 1-1; Sydney scored more relative to points allowed.
        d=build({"status":"uncertified_source_candidates","games":[
          self.game("1","2026-09-19T07:00Z",hs=100,aws=90),
          self.game("2","2026-09-20T07:00Z",hs=95,aws=100)]})
        ranked=[r["team"] for r in d["rows"] if r["played"]>0]
        self.assertEqual(ranked,["Sydney Kings","Perth Wildcats"])
        self.assertGreater(d["rows"][0]["points_pct"],d["rows"][1]["points_pct"])
    def test_standings_never_advertised_as_official(self):
        d=build({"status":"uncertified_source_candidates","games":[
           self.game("1","2026-09-20T09:30Z")]})
        self.assertEqual(d["status"],"source_derived_not_officially_reconciled")
        self.assertEqual(d["teams"],10)
if __name__=="__main__":unittest.main()

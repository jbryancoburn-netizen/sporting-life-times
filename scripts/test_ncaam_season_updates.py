import unittest
from copy import deepcopy
from datetime import date
from update_ncaam_season import build

def sample():
    # Model fixture is a minimal valid 365-team independent preseason list.
    ranks=[{"team_id":f"ncaa:{i}","team":f"Test School {i}","elo":1500+(365-i)/10,
            "rank":i+1,"conference":"Test","base_elo":1500,"offseason_adjustment":0}
            for i in range(365)]
    return {"rankings":ranks,"team_count":365}

def schedule():
    return [
        {"contest_id":"event-1","game_date":"11/03/2026","home":"Test School 0",
         "away":"Test School 1","home_score":"82","away_score":"74","status":"final"},
        {"contest_id":"event-2","game_date":"11/03/2026","home":"Test School 0",
         "away":"Test School 2","home_score":"64","away_score":"70","status":"final"},
        {"contest_id":"event-3","game_date":"11/06/2026","home":"Test School 2",
         "away":"Test School 3","home_score":"","away_score":"","status":"scheduled"},
    ]

class NCAAReplayTests(unittest.TestCase):
    def test_replay_exactly_once_across_repeated_runs(self):
        x=build(sample(),schedule(),date(2026,11,5))
        y=build(sample(),schedule(),date(2026,11,5))
        self.assertEqual(x,y)
        self.assertEqual(x[0]["games_played"],2)
        self.assertEqual(x[1]["count"],2)
        self.assertEqual(len(x[2]["games"]),1)
        byid={t["team_id"]:t for t in x[0]["rankings"]}
        self.assertEqual((byid["ncaa:0"]["wins"],byid["ncaa:0"]["losses"]),(1,1))
        self.assertEqual(byid["ncaa:1"]["losses"],1)

    def test_same_date_order_independence(self):
        first=build(sample(),schedule(),date(2026,11,5))
        changed=list(reversed(schedule()))
        second=build(sample(),changed,date(2026,11,5))
        self.assertEqual(first,second)

    def test_live_unconfirmed_is_not_final(self):
        games=schedule()+[{"contest_id":"event-4","game_date":"11/05/2026",
            "home":"Test School 5","away":"Test School 4",
            "home_score":"53","away_score":"42","status":"in progress"}]
        x=build(sample(),games,date(2026,11,5))
        self.assertEqual(x[1]["count"],2)

    def test_missing_and_conflicting_game_id(self):
        x=build(sample(),schedule()+[dict(schedule()[0])],date(2026,11,5))
        self.assertEqual(x[1]["count"],2)
        bad=dict(schedule()[0],home_score="83")
        with self.assertRaisesRegex(ValueError,"Contradictory duplicate"):
            build(sample(),schedule()+[bad],date(2026,11,5))

    def test_preseason_no_finals(self):
        x=build(sample(),schedule(),date(2026,10,24))
        self.assertEqual(x[0]["games_played"],0)
        self.assertTrue(all(t["season_games"]==0 for t in x[0]["rankings"]))

if __name__=="__main__":
    unittest.main()

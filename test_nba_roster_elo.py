import unittest
from scripts.nba_roster_elo import build

TEAMS="ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split()
def base():
    return {"league":"NBA","rankings":[{"team":t,"elo":1500.0} for t in TEAMS]}
def roster():
    return {"league":"NBA","as_of_utc":"2026-10-22T00:00:00Z","source":"test fixture only","baseline_source":"test fixture only","baseline_roster_impact_elo":{t:0.0 for t in TEAMS},"players":[
        {"team":"ATL","player_id":str(i),"expected_impact_elo":10.0,"projected_minutes":24,"availability":"out" if i==0 else "available"} for i in range(10)]}
class RosterEloTests(unittest.TestCase):
    def test_verified_overlay_math(self):
        result=build(base(),roster())
        atl=next(x for x in result["ratings"] if x["team"]=="ATL")
        self.assertEqual(atl["roster_adjusted_elo"],1550)
        self.assertEqual(atl["game_day_elo"],1545)
        self.assertEqual(atl["coverage"],"provisional")
        self.assertIsNone(next(x for x in result["ratings"] if x["team"]=="BOS")["roster_adjusted_elo"])
    def test_baseline_delta_avoids_double_counting(self):
        r=roster();r["baseline_roster_impact_elo"]["ATL"]=20.0
        atl=next(x for x in build(base(),r)["ratings"] if x["team"]=="ATL")
        self.assertEqual(atl["roster_adjusted_elo"],1530)
        self.assertEqual(atl["game_day_elo"],1525)
    def test_missing_baseline_rejected(self):
        r=roster();del r["baseline_roster_impact_elo"]
        with self.assertRaises(ValueError):build(base(),r)
    def test_no_empty_feed(self):
        r=roster();r["players"]=[]
        with self.assertRaises(ValueError):build(base(),r)
    def test_no_overallocated_minutes(self):
        r=roster()
        for p in r["players"]:p["projected_minutes"]=30
        with self.assertRaises(ValueError):build(base(),r)
    def test_no_duplicate_players(self):
        r=roster();r["players"][1]["player_id"]="0"
        with self.assertRaises(ValueError):build(base(),r)
    def test_no_missing_availability(self):
        r=roster();del r["players"][0]["availability"]
        with self.assertRaises(ValueError):build(base(),r)
    def test_low_minutes_withhold_both_ratings(self):
        r=roster()
        for p in r["players"]:p["projected_minutes"]=10
        atl=next(x for x in build(base(),r)["ratings"] if x["team"]=="ATL")
        self.assertIsNone(atl["roster_adjusted_elo"])
        self.assertIsNone(atl["game_day_elo"])
    def test_uncertain_status_does_not_invent_probability(self):
        for status in ("questionable","doubtful"):
            r=roster();r["players"][0]["availability"]=status
            atl=next(x for x in build(base(),r)["ratings"] if x["team"]=="ATL")
            self.assertEqual(atl["roster_adjusted_elo"],1550)
            self.assertIsNone(atl["game_day_elo"])
    def test_sourced_availability_probability(self):
        r=roster();r["players"][0].update(availability="questionable",availability_probability=.8,availability_probability_source="test fixture only")
        atl=next(x for x in build(base(),r)["ratings"] if x["team"]=="ATL")
        self.assertEqual(atl["game_day_elo"],1549)
    def test_unsourced_probability_rejected(self):
        r=roster();r["players"][0].update(availability="questionable",availability_probability=.8)
        with self.assertRaises(ValueError):build(base(),r)
    def test_player_on_multiple_teams_rejected(self):
        r=roster();other=dict(r["players"][0],team="BOS");r["players"].append(other)
        with self.assertRaises(ValueError):build(base(),r)
    def test_no_bool_impact(self):
        r=roster();r["players"][0]["expected_impact_elo"]=True
        with self.assertRaises(ValueError):build(base(),r)
if __name__=="__main__":unittest.main()

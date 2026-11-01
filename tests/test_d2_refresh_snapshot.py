"""No false "unchanged" outcome when an existing DII game is updated."""
import unittest
from scripts.build_d2_basketball import mutable_ledger, ledger_changed


class D2RefreshSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.prior = {
            "teams": [
                {"id": "away", "name": "School A", "elo": 1500.0, "w": 0, "l": 0,
                 "branding": {"colors": ["#123456", "#654321"]}},
                {"id": "home", "name": "School H", "elo": 1500.0, "w": 0, "l": 0}
            ],
            "games": [
                {"id": "id-original", "date": "2026-11-01", "away": "away",
                 "home": "home", "status": "scheduled", "away_score": None,
                 "home_score": None, "venue": "", "pred_home_pct": 59.2,
                 "psac_school_sources": ["https://psacsports.org/source1", "https://psacsports.org/source2"]}
            ]
        }

    def test_independent_copy_does_not_mutate_published_records(self):
        teams,games=mutable_ledger(self.prior)
        teams["away"]["branding"]["colors"].append("#ABCDEF")
        teams["away"]["elo"] = 1510
        games["id-original"]["psac_school_sources"].append("https://example.edu/other")
        games["id-original"]["venue"] = "Verified arena"
        self.assertEqual(self.prior["teams"][0]["elo"],1500)
        self.assertEqual(self.prior["teams"][0]["branding"]["colors"],["#123456","#654321"])
        self.assertEqual(self.prior["games"][0]["venue"],"")
        self.assertEqual(len(self.prior["games"][0]["psac_school_sources"]),2)

    def test_real_final_score_update_is_not_suppressed(self):
        teams,games=mutable_ledger(self.prior)
        self.assertFalse(ledger_changed(self.prior,list(teams.values()),list(games.values())))
        g=games["id-original"]
        g["status"]="final";g["away_score"]=78;g["home_score"]=72
        g["elo_change_away"]=8.2;g["elo_change_home"]=-8.2
        teams["away"]["elo"]=1508.2;teams["away"]["w"]=1
        teams["home"]["elo"]=1491.8;teams["home"]["l"]=1
        self.assertTrue(ledger_changed(self.prior,list(teams.values()),list(games.values())))
        self.assertEqual(self.prior["games"][0]["status"],"scheduled")
        self.assertEqual(self.prior["teams"][0]["w"],0)

    def test_existing_game_arena_enrichment_publishes_without_new_fixture(self):
        teams,games=mutable_ledger(self.prior)
        g=games["id-original"]
        g["venue"]="Beaver Athletics and Wellness Center · Reading, PA"
        g["venue_source_url"]="https://kubears.com/official"
        self.assertTrue(ledger_changed(self.prior,list(teams.values()),list(games.values())))
        self.assertEqual(self.prior["games"][0]["venue"],"")

    def test_new_game_or_team_metadata_is_detected(self):
        teams,games=mutable_ledger(self.prior)
        games["new-verified"]={**games["id-original"],"id":"new-verified","date":"2026-11-02"}
        self.assertTrue(ledger_changed(self.prior,list(teams.values()),list(games.values())))
        teams,games=mutable_ledger(self.prior)
        teams["home"]["primary"]="#001122"
        self.assertTrue(ledger_changed(self.prior,list(teams.values()),list(games.values())))

    def test_unchanged_ledger_remains_noop_even_after_a_noop_assignment(self):
        teams,games=mutable_ledger(self.prior)
        games["id-original"]["venue"]=""
        teams["away"]["elo"]=1500.0
        self.assertFalse(ledger_changed(self.prior,list(teams.values()),list(games.values())))


if __name__=="__main__":
    unittest.main()

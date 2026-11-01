import importlib.util
import unittest
from pathlib import Path

path=Path(__file__).resolve().parents[1] / "scripts" / "build_d2_basketball.py"
spec=importlib.util.spec_from_file_location("d2_builder_game",path)
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class D2GameIdentityTests(unittest.TestCase):
    def setUp(self):
        self.teams={
            "adams-state":{"id":"adams-state","name":"Adams State","slug":"adams-st"},
            "lake-erie":{"id":"lake-erie","name":"Lake Erie","slug":"lake-erie"},
        }
        self.lookup=builder.build_dii_team_lookup(self.teams)
        self.verified={
            "id":"organizer-game-1","date":"2026-10-30","away":"adams-state","home":"lake-erie",
            "away_score":75,"home_score":69,"status":"final","neutral":True,
            "source":"official tournament organizer","elo_eligible":True,
            "source_url":"https://example.org/official-tournament"
        }

    def test_national_scoreboard_team_slugs_map_to_one_local_program(self):
        self.assertEqual(builder.resolve_dii_team_id(
            {"id":"unrelated-school","slug":"adams-st","name":"Adams St."},self.lookup),"adams-state")
        self.assertEqual(builder.resolve_dii_team_id(
            {"id":"lake-erie","slug":"","name":"Lake Erie"},self.lookup),"lake-erie")
        self.assertIsNone(builder.resolve_dii_team_id(
            {"id":"visitor","slug":"division-iii-school","name":"Division III College"},self.lookup))

    def test_official_duplicate_does_not_double_count_neutral_tournament_final(self):
        games={self.verified["id"]:dict(self.verified)}
        duplicate={"id":"ncaa-777","date":"2026-10-30","status":"final",
                   "away_score":69,"home_score":75,"neutral":False}
        disposition=builder.merge_ncaa_contest(games,duplicate,"lake-erie","adams-state")
        self.assertEqual(disposition,"confirmed_duplicate")
        self.assertEqual(len(games),1)
        self.assertTrue(games[self.verified["id"]]["neutral"])
        self.assertEqual(games[self.verified["id"]]["away_score"],75)

    def test_final_disagreement_is_quarantined(self):
        games={self.verified["id"]:dict(self.verified)}
        disagreement={"id":"ncaa-777","date":"2026-10-30","status":"final",
                      "away_score":99,"home_score":75}
        status=builder.merge_ncaa_contest(games,disagreement,"lake-erie","adams-state")
        self.assertEqual(status,"score_conflict")
        self.assertEqual(len(games),1)
        self.assertEqual(games[self.verified["id"]]["away_score"],75)

    def test_future_game_and_final_share_one_id(self):
        games={self.verified["id"]:{**self.verified,"status":"scheduled","away_score":None,"home_score":None}}
        ncaa={"id":"ncaa-777","date":"2026-10-30","status":"final",
              "away_score":69,"home_score":75,"network":"ESPN+"}
        status=builder.merge_ncaa_contest(games,ncaa,"lake-erie","adams-state")
        self.assertEqual(status,"updated")
        self.assertEqual(len(games),1)
        self.assertEqual(games[self.verified["id"]]["away_score"],75)
        self.assertTrue(games[self.verified["id"]]["neutral"])
        self.assertEqual(games[self.verified["id"]]["status"],"final")

if __name__=="__main__":
    unittest.main()

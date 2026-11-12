"""Independent baseline invariants: identity, score, status, venues and players."""
import unittest
from datetime import datetime
from scripts.audit_cbb_baseline_reconciliation import (
    identity, schedule_match, venue_agrees, inspect_player,
    index_games, normalized_id
)

SOURCE_M={"id":"espn:401900111","date":"2026-11-11",
          "home_id":"ncaa:100","away_id":"ncaa:200",
          "home_score":78,"away_score":72}
SCORES_M={"84":78,"153":72}
SOURCE_W={"id":"401999222","date":"2026-11-11T17:00Z",
          "home_id":"84","away_id":"87",
          "home_score":81,"away_score":78}

def mrow(eid="401900111",home="84",away="153",
         score1=78,score2=72,official=False,completed=True):
    out={"id":eid,"date":"2026-11-11T23:00:00Z",
         "status":{"type":{"completed":completed}},
         "competitions":[{"competitors":[
             {"homeAway":"home","team":{"id":home},"score":score1},
             {"homeAway":"away","team":{"id":away},"score":score2}]}]}
    if official:
        out["official_source"]=True
        out["school_source_url"]="https://example.edu/schedule"
    return out

class BaselineTests(unittest.TestCase):
    def test_source_id_namespace_is_normalized(self):
        self.assertEqual(normalized_id("espn:401900111"),"401900111")

    def test_exact_men_final_is_found(self):
        self.assertTrue(schedule_match(mrow(),SOURCE_M,SCORES_M,"men"))

    def test_unrelated_game_same_score_does_not_pass(self):
        self.assertFalse(schedule_match(mrow("another",home="999",away="888"),
                                        SOURCE_M,SCORES_M,"men"))

    def test_unverified_alternate_id_does_not_pass(self):
        self.assertFalse(schedule_match(mrow("another"),SOURCE_M,SCORES_M,"men"))

    def test_official_calendar_alias_passes(self):
        self.assertTrue(schedule_match(mrow("school-record-123",official=True),
                                       SOURCE_M,SCORES_M,"men"))

    def test_unfinished_game_does_not_pass(self):
        self.assertFalse(schedule_match(mrow(completed=False),SOURCE_M,SCORES_M,"men"))

    def test_mismatched_school_score_fails(self):
        self.assertFalse(schedule_match(mrow(score2=71),SOURCE_M,SCORES_M,"men"))

    def test_women_two_school_schedule_match(self):
        row={"id":"401999222","date":"2026-11-11T17:00Z",
             "home_id":"84","away_id":"87",
             "home_score":81,"away_score":78,"completed":True}
        self.assertTrue(schedule_match(row,SOURCE_W,{"84":81,"87":78},"women"))
        row["away_score"]=77
        self.assertFalse(schedule_match(row,SOURCE_W,{"84":81,"87":78},"women"))

    def test_women_neutral_site_home_away_flip_preserves_score_by_team(self):
        row={"id":"401999222","date":"2026-11-11T17:00Z",
             "home_id":"87","away_id":"84",
             "home_score":78,"away_score":81,"completed":True}
        self.assertTrue(schedule_match(row,SOURCE_W,{"84":81,"87":78},"women"))

    def test_duplicate_source_ids_are_reported(self):
        games,duplicate=index_games([SOURCE_M,SOURCE_M])
        self.assertEqual(len(games),1)
        self.assertEqual(len(duplicate),1)

    def test_venue_aliases_and_disagreement_are_distinct(self):
        self.assertTrue(venue_agrees("State Farm Arena","State Farm Arena (Atlanta)"))
        self.assertFalse(venue_agrees("State Farm Arena","Hinkle Fieldhouse"))

    def test_player_points_mismatch_is_reported(self):
        entry={"home":{"players":[{"pts":70}]},"away":{"players":[{"pts":72}]}}
        notes,problems=inspect_player("men",SOURCE_M,[("ncaa_player_boxscores",entry)])
        self.assertEqual(len(problems),1)
        self.assertEqual(len(notes),1)

    def test_source_score_identity_requires_exact_values(self):
        different=dict(SOURCE_M,home_score=79)
        self.assertNotEqual(identity(SOURCE_M),identity(different))

if __name__=="__main__":
    unittest.main()

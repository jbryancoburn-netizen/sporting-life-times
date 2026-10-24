import unittest
from datetime import date
from ncaam_espn_source import collect,normalize_event,merge,write_cache
from tempfile import TemporaryDirectory
from pathlib import Path

CROSS={
    "2619":{"team_id":"ncaa:100","team":"Test College","conference":"Test"},
    "16231":{"team_id":"ncaa:101","team":"Another College","conference":"Test"},
}

def sample(complete=True,home_score="86",away_score="74",event_id="40100000"):
    return {"id":event_id,"date":"2026-11-02T23:00:00Z",
        "status":{"type":{"completed":complete}},
        "competitions":[{"competitors":[
            {"homeAway":"home","team":{"id":"2619"},"score":home_score},
            {"homeAway":"away","team":{"id":"16231"},"score":away_score},
        ]}]}

class ESPNSourceTests(unittest.TestCase):
    def test_authoritative_completed_flag_only(self):
        final,why=normalize_event(sample(),CROSS)
        self.assertIsNone(why)
        self.assertEqual(final["status"],"final")
        self.assertEqual(final["contest_id"],"espn:40100000")
        self.assertEqual(final["game_date"],"2026-11-02")
        live,_=normalize_event(sample(complete=False),CROSS)
        self.assertEqual(live["status"],"scheduled")
        self.assertEqual(live["home_score"],"")

    def test_unknown_espn_program_never_gets_guessed(self):
        game=sample()
        game["competitions"][0]["competitors"][0]["team"]["id"]="999999"
        row,why=normalize_event(game,CROSS)
        self.assertIsNone(row)
        self.assertEqual(why,"unmatched_espn_program")

    def test_final_score_correction_replaces_not_adds_game(self):
        before,_=normalize_event(sample(),CROSS)
        after,_=normalize_event(sample(home_score="89"),CROSS)
        rows,count=merge([before],[after])
        self.assertEqual(len(rows),1)
        self.assertEqual(count,1)
        self.assertEqual(rows[0]["home_score"],"89")

    def test_transient_nonfinal_never_erases_final(self):
        before,_=normalize_event(sample(),CROSS)
        degradation,_=normalize_event(sample(complete=False),CROSS)
        rows,count=merge([before],[degradation])
        self.assertEqual(len(rows),1)
        self.assertEqual(count,0)
        self.assertEqual(rows[0]["status"],"final")

    def test_unchanged_events_do_not_rewrite_cache(self):
        with TemporaryDirectory() as temp:
            path=Path(temp)/"events.json"
            row,_=normalize_event(sample(),CROSS)
            self.assertTrue(write_cache(path,[row]))
            original=path.read_bytes()
            self.assertFalse(write_cache(path,[row]))
            self.assertEqual(original,path.read_bytes())
            changed=dict(row,home_score="88")
            self.assertTrue(write_cache(path,[changed]))
            self.assertNotEqual(original,path.read_bytes())

    def test_identity_changes_abort(self):
        previous,_=normalize_event(sample(),CROSS)
        changed=dict(previous,away="Wrong School")
        with self.assertRaisesRegex(ValueError,"participant identity changed"):
            merge([previous],[changed])

if __name__=="__main__":unittest.main()

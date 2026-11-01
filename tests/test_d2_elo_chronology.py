"""Regression gates for actual DII intraday Elo chronology."""
import unittest
from scripts.d2_elo_chronology import tipoff_minute, game_sort_key

class DiiChronologyTests(unittest.TestCase):
    def test_meridiem_not_lexicographic(self):
        self.assertEqual(tipoff_minute("12:00 AM ET"), 0)
        self.assertEqual(tipoff_minute("2:00 PM ET"), 14*60)
        self.assertEqual(tipoff_minute("10:00 PM ET"), 22*60)
        self.assertEqual(tipoff_minute("12:00 PM ET"), 12*60)
        self.assertEqual(tipoff_minute("11:59 PM ET"), 23*60+59)

    def test_unknown_tipoff_last_no_guess(self):
        for value in (None,"", "TBA", "7:30 PM CT","13:00 ET","25:00 PM ET"):
            self.assertEqual(tipoff_minute(value), 1440)

    def test_date_then_time_then_stable_id(self):
        fixtures=[
            {"id":"late","date":"2026-11-01","start_time":"10:00 PM ET"},
            {"id":"early","date":"2026-11-01","start_time":"2:00 PM ET"},
            {"id":"unknown","date":"2026-11-01","start_time":None},
            {"id":"prior","date":"2026-10-31","start_time":None},
            {"id":"aa","date":"2026-11-01","start_time":"2:00 PM ET"}]
        self.assertEqual([g["id"] for g in sorted(fixtures,key=game_sort_key)],
                         ["prior","aa","early","late","unknown"])

if __name__=="__main__":
    unittest.main()

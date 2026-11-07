"""Prevent silently dropping finals found only in the ungrouped MBB feed."""
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch
from datetime import date

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'scripts/collect-mbb-retro-finals.py'
spec = importlib.util.spec_from_file_location('collect_mbb_retro_finals', SCRIPT)
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


def payload(*ids):
    return io.BytesIO(json.dumps({'events': [{'id': str(x)} for x in ids]}).encode())


class CoverageTests(unittest.TestCase):
    def test_merge_ungrouped_only_game_and_deduplicate(self):
        def fake_open(request, timeout=18):
            url = request.full_url
            return payload(10, 11) if 'groups=50' not in url else payload(10)
        with patch.object(collector.urllib.request, 'urlopen', fake_open):
            rows, errors = collector.scoreboard_events(date(2026, 11, 6))
        self.assertEqual({r['id'] for r in rows}, {'10', '11'})
        self.assertEqual(len(rows), 2)
        self.assertFalse(errors)

    def test_one_feed_can_fail_without_discarding_other(self):
        def fake_open(request, timeout=18):
            if 'groups=50' in request.full_url:
                raise OSError('partial feed outage')
            return payload(21)
        with patch.object(collector.urllib.request, 'urlopen', fake_open):
            rows, errors = collector.scoreboard_events(date(2026, 11, 6))
        self.assertEqual(rows[0]['id'], '21')
        self.assertEqual(len(errors), 1)

    def test_both_feeds_failing_is_not_a_success(self):
        with patch.object(collector.urllib.request, 'urlopen', side_effect=OSError('offline')):
            with self.assertRaisesRegex(RuntimeError, 'Both scoreboard feeds unavailable'):
                collector.scoreboard_events(date(2026, 11, 6))


if __name__ == '__main__':
    unittest.main()

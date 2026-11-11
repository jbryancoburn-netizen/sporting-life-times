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



class CalendarNameFallbackTests(unittest.TestCase):
    """A blank ESPN name must not prevent verified finals reaching both schools."""

    def test_blank_espn_name_is_safe_and_idempotent(self):
        import tempfile
        from unittest.mock import patch

        calendar_path = pathlib.Path(__file__).resolve().parents[1] / 'scripts/sync_cbb_final_calendars.py'
        cal_spec = importlib.util.spec_from_file_location('sync_cbb_final_calendars', calendar_path)
        cal = importlib.util.module_from_spec(cal_spec)
        cal_spec.loader.exec_module(cal)

        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            schedules = root / 'mbb-schedules-2026-27'
            schedules.mkdir()
            ratings = {
                'season': '2026-27', 'starting_elo': 1500,
                'rankings': [{} for _ in range(365)],
                'events': [{
                    'id': 'espn:401921740', 'date': '2026-11-10',
                    'home_id': 'ncaa:2', 'away_id': 'ncaa:1',
                    'home_score': 98, 'away_score': 82,
                }],
            }
            crosswalk = {'teams': [
                {'id': 'ncaa:1', 'name': 'Queens (NC)', 'espn_id': '2511',
                 'espn_name': None, 'full_team_name': 'Queens Royals'},
                {'id': 'ncaa:2', 'name': 'BYU', 'espn_id': '252',
                 'espn_name': 'BYU Cougars'},
            ]}
            for filename, data in (
                ('ncaam-2026-27-retro-primary.json', ratings),
                ('ncaam-2026-27-espn-team-crosswalk.json', crosswalk),
            ):
                (root / filename).write_text(json.dumps(data), encoding='utf-8')
            for espn_id in ('2511', '252'):
                (schedules / (espn_id + '.json')).write_text(json.dumps({
                    'season': '2026-27', 'espn_team_id': espn_id, 'events': [],
                }), encoding='utf-8')

            with patch.object(cal, 'DATA', root):
                first = cal.men()
                second = cal.men()

            self.assertEqual(first['men_files'], 2)
            self.assertEqual(first['men_added'], 2)
            self.assertEqual(second['men_files'], 0)
            self.assertEqual(second['men_added'], 0)
            for espn_id in ('2511', '252'):
                doc = json.loads((schedules / (espn_id + '.json')).read_text())
                self.assertEqual(len(doc['events']), 1)
                event = doc['events'][0]
                self.assertEqual(event['name'], 'Queens Royals at BYU Cougars')
                sides = event['competitions'][0]['competitors']
                self.assertEqual({s['team']['displayName'] for s in sides},
                                 {'Queens Royals', 'BYU Cougars'})
                self.assertEqual({s['team']['id']: s['score'] for s in sides},
                                 {'252': 98, '2511': 82})

    def test_empty_verified_identity_raises(self):
        calendar_path = pathlib.Path(__file__).resolve().parents[1] / 'scripts/sync_cbb_final_calendars.py'
        spec = importlib.util.spec_from_file_location('sync_cbb_final_calendars', calendar_path)
        cal = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cal)
        with self.assertRaisesRegex(ValueError, 'no display name'):
            cal.verified_team_name({'id': 'ncaa:99', 'espn_name': None})


if __name__ == '__main__':
    unittest.main()

import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('finish', pathlib.Path(__file__).with_name('mbb_finish_reconciliation.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ReconciliationTests(unittest.TestCase):
    def test_exact_aliases_need_independent_date_and_opponent(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous = m.D
            m.D = pathlib.Path(tmp)
            try:
                teams = [dict(espn_id='1', id='ncaa:1', name='Host', espn_name='Host Hawks'),
                         dict(espn_id='30', id='ncaa:30', name='Southern California', espn_name='USC Trojans')]
                def put(name, obj):
                    path = m.D / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(json.dumps(obj))
                put('ncaam-2026-27-espn-team-crosswalk.json', {'teams': teams})
                put('mbb-branding.json', {'teams': {'30': {'abbreviation': 'USC'}}})
                put('mbb-logo-registry.json', {'teams': {}})
                def event(eid, date, label, oid=''):
                    return dict(id=eid, date=date+'T17:00:00Z', competitions=[dict(competitors=[
                        {'team': {'id': '1'}, 'homeAway': 'unknown'},
                        {'team': {'id': oid, 'displayName': label}, 'homeAway': 'unknown'}], venue={})])
                put('mbb-schedules-2026-27/1.json', {'events': [
                    event('preserve-this-id', '2026-11-02', 'USC'),
                    event('wrong-date', '2026-11-03', 'USC'),
                    event('prefix-collision', '2026-11-02', 'USC Upstate'),
                    event('existing-disagreement', '2026-11-02', 'USC', '999')]})
                put('mbb-schedules-2026-27/30.json', {'events': []})
                put('mbb-official-game-evidence/30.json', {'source_url': 'https://usctrojans.com/schedule', 'rows': [
                    dict(date='2026-11-02', opponent='Host', arena='Named Arena', city='Los Angeles, CA',
                         site='home', site_explicit=True, tv='')
                ]})
                with contextlib.redirect_stdout(io.StringIO()):
                    m.main()
                events = json.loads((m.D/'mbb-schedules-2026-27/1.json').read_text())['events']
                self.assertEqual(events[0]['id'], 'preserve-this-id')
                self.assertEqual(events[0]['competitions'][0]['competitors'][1]['team']['id'], '30')
                self.assertEqual(events[0]['competitions'][0]['venue']['arenaName'], 'Named Arena')
                self.assertEqual(events[0]['competitions'][0]['competitors'][0]['homeAway'], 'away')
                self.assertFalse(events[1]['competitions'][0]['competitors'][1]['team']['id'])
                self.assertFalse(events[2]['competitions'][0]['competitors'][1]['team']['id'])
                self.assertEqual(events[3]['competitions'][0]['competitors'][1]['team']['id'], '999')
                self.assertNotIn('official_school_time', events[0])
                before = (m.D/'mbb-schedules-2026-27/1.json').read_text()
                with contextlib.redirect_stdout(io.StringIO()):
                    m.main()
                self.assertEqual((m.D/'mbb-schedules-2026-27/1.json').read_text(), before)
            finally:
                m.D = previous


if __name__ == '__main__':
    unittest.main()

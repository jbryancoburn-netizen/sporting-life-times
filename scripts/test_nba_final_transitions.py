import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('transition', Path(__file__).with_name('verify-nba-final-transitions.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Transitions(unittest.TestCase):
    def setUp(self):
        self.final = {'id': 'g1', 'state': 'post', 'teams': [{'home_away': 'home', 'code': 'BOS', 'score': 110}, {'home_away': 'away', 'code': 'CHI', 'score': 100}]}
        self.elo = {'events': [{'id': 'g1', 'home': 'BOS', 'away': 'CHI', 'home_score': 110, 'away_score': 100}]}
    def call(self, prior, state='post', elo=None):
        return m.observe(prior, {'games': [{'id': 'g1', 'state': state}]}, {'games': [self.final]}, self.elo if elo is None else elo, 'now')
    def test_unseen_live_state_never_certifies(self):
        self.assertEqual(self.call({})['verified_transitions'], 0)
    def test_live_then_final_certifies_and_repeated_observation_is_one(self):
        live = self.call({}, 'in')
        final = self.call(live)
        self.assertEqual(final['verified_transitions'], 1)
        self.assertEqual(self.call(final)['verified_transitions'], 1)
    def test_missing_or_duplicate_elo_blocks(self):
        live = self.call({}, 'in')
        for events in ([], self.elo['events'] * 2):
            result = self.call(live, elo={'events': events})
            self.assertEqual(result['verified_transitions'], 0)
            self.assertTrue(result['issues'])
    def test_conflicting_score_blocks(self):
        self.final['teams'][0]['score'] = 111
        result = self.call(self.call({}, 'in'))
        self.assertEqual(result['verified_transitions'], 0)
        self.assertTrue(result['issues'])

if __name__ == '__main__': unittest.main()

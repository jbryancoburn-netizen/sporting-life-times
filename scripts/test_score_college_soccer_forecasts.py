import copy
import datetime as dt
import math
import unittest

from score_college_soccer_forecasts import score_forecasts


class ForecastScoringTests(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime.fromisoformat('2026-10-24T22:00:00+00:00')
        self.f = {'status': 'prospective_research_only', 'count_locked': 1, 'forecasts': [{
            'match_id': 'men-1', 'cohort': 'men-d1', 'model': 'test',
            'home_team': 'a', 'away_team': 'b', 'source_game': 'https://www.ncaa.com/game/1',
            'kickoff_utc': '2026-10-24T18:00:00+00:00',
            'forecasted_at_utc': '2026-10-24T12:00:00+00:00',
            'p_away': .2, 'p_draw': .3, 'p_home': .5}]}
        self.l = {'results': [{'match_id': 'men-1', 'gender': 'men', 'date': '2026-10-24',
            'home_team': 'a', 'away_team': 'b', 'home_goals': 2, 'away_goals': 0,
            'source_game': 'https://www.ncaa.com/game/1'}]}

    def score(self):
        return score_forecasts(self.f, self.l, self.now)

    def test_known_metrics_immutable_and_repeatable(self):
        original = copy.deepcopy((self.f, self.l))
        r = self.score()
        self.assertAlmostEqual(r['overall']['mean_log_loss'], -math.log(.5))
        self.assertAlmostEqual(r['overall']['mean_brier_score'], .38)
        self.assertEqual(r['overall']['pick_accuracy'], 1)
        self.assertEqual(self.score(), r)
        self.assertEqual((self.f, self.l), original)

    def test_no_finals_means_no_fabricated_accuracy(self):
        self.l['results'] = []
        r = self.score()
        self.assertEqual(r['awaiting_final'], 1)
        self.assertIsNone(r['overall']['mean_log_loss'])
        self.assertIsNone(r['overall']['pick_accuracy'])

    def test_away_and_draw(self):
        for hg, ag, probability in [(0, 1, .2), (0, 0, .3)]:
            self.l['results'][0].update(home_goals=hg, away_goals=ag)
            self.assertAlmostEqual(self.score()['overall']['mean_log_loss'], -math.log(probability))

    def test_after_kickoff_and_naive_timestamp_rejected(self):
        for value in ['2026-10-24T18:00:00+00:00', '2026-10-24T12:00:00']:
            self.f['forecasts'][0]['forecasted_at_utc'] = value
            with self.assertRaises(ValueError): self.score()

    def test_duplicates_rejected(self):
        self.l['results'] *= 2
        with self.assertRaisesRegex(ValueError, 'duplicate final'): self.score()
        self.l['results'] = self.l['results'][:1]
        self.f['forecasts'] *= 2
        self.f['count_locked'] = 2
        with self.assertRaisesRegex(ValueError, 'duplicate forecast'): self.score()

    def test_bad_probabilities_rejected(self):
        for p in [-.1, float('nan'), 1.5, .9]:
            self.f['forecasts'][0]['p_home'] = p
            with self.assertRaises(ValueError): self.score()

    def test_identity_and_schedule_mismatch_rejected(self):
        for field, value in [('home_team', 'wrong'), ('date', '2026-10-23'), ('gender', 'women')]:
            original = self.l['results'][0][field]
            self.l['results'][0][field] = value
            with self.assertRaises(ValueError): self.score()
            self.l['results'][0][field] = original

    def test_future_final_rejected(self):
        self.now = dt.datetime.fromisoformat('2026-10-24T13:00:00+00:00')
        with self.assertRaises(ValueError): self.score()


if __name__ == '__main__':
    unittest.main()

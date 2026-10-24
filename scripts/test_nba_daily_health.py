import copy
import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('nba_health', Path(__file__).with_name('audit-nba-daily-health.py'))
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class NBAHealthTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 24, 18, tzinfo=timezone.utc)
        self.stamp = '2026-10-24T18:00:00Z'
        self.game = {'id': 'espn-nba-123', 'date': '2026-10-24T02:00:00Z', 'state': 'post',
                     'teams': [{'home_away': 'home', 'code': 'CHI', 'score': 110},
                               {'home_away': 'away', 'code': 'NY', 'score': 100}], 'players': [{}]}
        self.elo = {'rankings': [{}] * 30, 'games_played': 1,
                    'events': [{'id': 'espn-nba-123', 'date': self.game['date'], 'home': 'CHI',
                                'away': 'NYK', 'home_score': 110, 'away_score': 100}]}
        self.boxes = {'updated_at': self.stamp, 'games': [copy.deepcopy(self.game)]}
        self.schedule = {'updated_at': self.stamp, 'games': [copy.deepcopy(self.game)]}

    def run_audit(self):
        return health.audit(self.elo, self.boxes, {'updated_at': self.stamp, 'season_totals': [{}]},
                            {'updated_at': self.stamp, 'articles': [{}]}, {}, self.schedule, self.now)

    def test_matching_final_and_team_alias_are_healthy(self):
        self.assertEqual(self.run_audit()['issues'], [])

    def test_final_missing_from_elo_is_not_healthy(self):
        self.elo.update(events=[], games_played=0)
        report = self.run_audit()
        self.assertIn('finals_missing_from_elo', report['issues'])
        self.assertEqual(report['elo']['missing_final_ids'], ['espn-nba-123'])

    def test_schedule_final_without_box_or_elo_is_detected(self):
        self.boxes['games'] = []
        self.elo.update(events=[], games_played=0)
        self.assertIn('finals_missing_from_elo', self.run_audit()['issues'])

    def test_score_conflict_is_detected(self):
        self.schedule['games'][0]['teams'][0]['score'] = 111
        self.assertIn('final_score_conflict', self.run_audit()['issues'])

    def test_stale_live_scoreboard_is_detected(self):
        self.schedule['games'][0]['state'] = 'in'
        self.schedule['updated_at'] = '2026-10-24T17:00:00Z'
        self.assertIn('scoreboard_stale', self.run_audit()['issues'])

    def test_duplicate_ledger_and_missing_player_boxes_are_detected(self):
        self.elo['events'] *= 2
        self.elo['games_played'] = 2
        self.boxes['games'][0]['players'] = []
        report = self.run_audit()
        self.assertIn('elo_ledger_inconsistent', report['issues'])
        self.assertIn('finals_missing_player_boxes', report['issues'])

    def test_past_scheduled_game_is_detected(self):
        self.schedule['games'][0]['state'] = 'pre'
        self.assertIn('scoreboard_overdue_scheduled_games', self.run_audit()['issues'])


if __name__ == '__main__':
    unittest.main()

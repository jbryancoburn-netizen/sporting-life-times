#!/usr/bin/env python3
"""Read-only NBA reconciliation; writes a report, never changes source data."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES = {'NY': 'NYK', 'GS': 'GSW', 'SA': 'SAS', 'NO': 'NOP', 'WSH': 'WAS', 'UTAH': 'UTA'}


def age(value, now):
    try:
        return round((now - datetime.fromisoformat(value.replace('Z', '+00:00'))).total_seconds() / 3600, 2)
    except (TypeError, ValueError, AttributeError):
        return None


def fixture(game):
    if game.get('teams'):
        sides = {t.get('home_away'): t for t in game['teams']}
        home, away = sides.get('home', {}), sides.get('away', {})
        h, a = home.get('code'), away.get('code')
    else:
        h, a = game.get('home'), game.get('away')
    if not h or not a:
        return None
    return (str(game.get('date') or '')[:10], ALIASES.get(h, h), ALIASES.get(a, a))


def score(game):
    try:
        if game.get('teams'):
            sides = {t.get('home_away'): t for t in game['teams']}
            values = (sides['home']['score'], sides['away']['score'])
        else:
            values = (game['home_score'], game['away_score'])
        result = tuple(float(v) for v in values)
        return result if all(v >= 0 and v.is_integer() for v in result) else None
    except (KeyError, ValueError, TypeError):
        return None


def audit(elo, boxes, players, news, roster, schedule, now):
    completed = [g for g in boxes.get('games', []) if g.get('state') == 'post']
    player_boxes = [g for g in completed if g.get('players')]
    events = elo.get('events', [])
    ledger = {fixture(g): g for g in events if fixture(g)}
    player_fixtures = {fixture(g) for g in player_boxes if fixture(g)}
    observed = [g for g in schedule.get('games', []) if g.get('state') == 'post'] + completed
    missing, conflicts, invalid = set(), set(), set()
    for game in observed:
        key = fixture(game)
        label = str(game.get('id') or key)
        if key is None or score(game) is None:
            invalid.add(label)
        elif key not in ledger:
            missing.add(label)
        elif score(game) != score(ledger[key]):
            conflicts.add(label)
    live = [g for g in schedule.get('games', []) if g.get('state') == 'in']
    overdue = [str(g.get('id')) for g in schedule.get('games', [])
               if g.get('state') == 'pre' and age(g.get('date'), now) is not None
               and age(g.get('date'), now) > .25]
    snap = {
        'checked_at': now.isoformat(),
        'elo': {'teams': len(elo.get('rankings', [])), 'completed_games': len(events),
                'games_played': elo.get('games_played'), 'missing_final_ids': sorted(missing),
                'conflicting_final_ids': sorted(conflicts), 'invalid_final_ids': sorted(invalid)},
        'box_scores': {'completed_games': len(player_boxes),
                       'player_lines': sum(len(g.get('players', [])) for g in player_boxes),
                       'updated_at': boxes.get('updated_at'), 'age_hours': age(boxes.get('updated_at'), now),
                       'fixtures_missing_player_boxes': len(set(ledger) - player_fixtures)},
        'scoreboard': {'updated_at': schedule.get('updated_at'), 'age_hours': age(schedule.get('updated_at'), now),
                       'games': len(schedule.get('games', [])), 'live_games': len(live),
                       'overdue_scheduled_ids': overdue},
        'player_stats': {'players': len(players.get('season_totals', [])), 'leader_rows': len(players.get('rows', [])),
                         'updated_at': players.get('updated_at'), 'age_hours': age(players.get('updated_at'), now)},
        'news': {'stories': len(news.get('articles', [])), 'updated_at': news.get('updated_at'),
                 'age_hours': age(news.get('updated_at'), now)},
        'roster': {'injuries': len(roster.get('injuries', [])), 'transactions': len(roster.get('transactions', [])),
                   'injury_age_hours': age(roster.get('injuries_as_of'), now),
                   'transaction_age_hours': age(roster.get('transactions_as_of'), now)},
    }
    issues = []
    if (snap['elo']['teams'] != 30 or len(events) != elo.get('games_played')
            or len(ledger) != len(events) or len({g.get('id') for g in events}) != len(events)):
        issues.append('elo_ledger_inconsistent')
    if missing:
        issues.append('finals_missing_from_elo')
    if conflicts:
        issues.append('final_score_conflict')
    if invalid:
        issues.append('invalid_final_records')
    if not player_boxes:
        issues.append('no_player_box_scores')
    if snap['box_scores']['fixtures_missing_player_boxes']:
        issues.append('finals_missing_player_boxes')
    if overdue:
        issues.append('scoreboard_overdue_scheduled_games')
    if not snap['player_stats']['players']:
        issues.append('no_player_season_totals')
    if not snap['news']['stories']:
        issues.append('no_nba_news')
    for label, threshold in [('box_scores', 6), ('player_stats', 6), ('news', 4), ('scoreboard', .5 if live else 6)]:
        value = snap[label]['age_hours']
        if value is None or value < 0 or value > threshold:
            issues.append(label + '_stale')
    snap['issues'] = issues
    snap['status'] = 'attention' if issues else 'healthy'
    return snap


def main():
    def read(path):
        try:
            return json.loads((ROOT / path).read_text())
        except (OSError, ValueError):
            return {}
    paths = ['nba-2026-27-current-provisional.json', 'nba-game-center.json', 'nba-player-leaders.json',
             'nba-top-stories.json', 'nba-roster-wire-snapshot.json', 'nba-upcoming-schedule.json']
    snap = audit(*(read('data/' + p) for p in paths), datetime.now(timezone.utc))
    (ROOT / 'data/nba-pipeline-health.json').write_text(json.dumps(snap, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(snap, indent=2))
    if snap['issues']:
        raise SystemExit('Pipeline warning: ' + ', '.join(snap['issues']))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Record observed public live-to-final transitions. Never infers an unseen live state."""
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://jbryancoburn-netizen.github.io/sporting-life-times/'


def observe(previous, schedule, archive, elo, checked_at):
    history = dict(previous.get('games', {}))
    events = elo.get('events', [])
    boxes = {g['id']: g for g in archive.get('games', []) if g.get('state') == 'post'}
    issues = []
    for game in schedule.get('games', []) + archive.get('games', []):
        gid = str(game.get('id', ''))
        if not gid:
            continue
        row = dict(history.get(gid, {}))
        if game.get('state') == 'in':
            row.setdefault('first_observed_live_at', checked_at)
        if game.get('state') == 'post':
            row.setdefault('first_observed_final_at', checked_at)
        row['last_observed_state'] = game.get('state')
        history[gid] = row
    for gid, row in history.items():
        if not row.get('first_observed_live_at') or not row.get('first_observed_final_at'):
            continue
        matches = [g for g in events if g.get('id') == gid]
        box = boxes.get(gid)
        row['public_elo_entries'] = len(matches)
        row['verified'] = False
        if len(matches) != 1 or box is None:
            issues.append(gid + ': final missing or duplicated in public archive/Elo')
            continue
        sides = {t.get('home_away'): t for t in box.get('teams', [])}
        event = matches[0]
        try:
            for side in ('home', 'away'):
                assert event[side] == sides[side]['code']
                assert event[side + '_score'] == int(sides[side]['score'])
        except (KeyError, ValueError, TypeError, AssertionError):
            issues.append(gid + ': public final teams or scores conflict')
            continue
        row['verified'] = True
        row.setdefault('first_verified_at', checked_at)
        row['last_verified_at'] = checked_at
    verified = sum(bool(r.get('verified')) for r in history.values())
    return {'checked_at': checked_at, 'source': BASE, 'games': history,
            'verified_transitions': verified, 'issues': issues,
            'status': 'attention' if issues else 'verified' if verified else 'awaiting_observed_transition'}


def main():
    target = ROOT / 'data/nba-final-transition-evidence.json'
    previous = json.loads(target.read_text()) if target.exists() else {}
    def get(path):
        with urllib.request.urlopen(BASE + path, timeout=25) as response:
            return json.load(response)
    # Only update evidence after every public resource has been retrieved successfully.
    result = observe(previous, get('data/nba-upcoming-schedule.json'), get('data/nba-game-center.json'),
                     get('data/nba-2026-27-current-provisional.json'), datetime.now(timezone.utc).isoformat())
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'games'}, indent=2))
    if result['issues']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()

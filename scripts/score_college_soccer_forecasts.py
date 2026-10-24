"""Score archived pregame probabilities without modifying the forecast ledger."""
from __future__ import annotations

import argparse
import datetime as dt
import math
from pathlib import Path
from zoneinfo import ZoneInfo

from update_college_soccer_elo import COHORTS, HERE, atomic_json, canonical_digest, read_json


def timestamp(value):
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError('timestamp requires explicit timezone')
    return parsed


def score_forecasts(archive, ledger, now):
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError('now requires explicit timezone')
    if archive.get('status') != 'prospective_research_only':
        raise ValueError('unrecognized forecast archive')
    forecasts = archive['forecasts']
    if archive['count_locked'] != len(forecasts):
        raise ValueError('forecast count mismatch')
    finals = {}
    for g in ledger['results']:
        if g['match_id'] in finals:
            raise ValueError('duplicate final ID')
        if any(type(g[k]) is not int or not 0 <= g[k] <= 40 for k in ('home_goals', 'away_goals')):
            raise ValueError('invalid final score')
        finals[g['match_id']] = g
    seen, scored, quarantined = set(), [], []
    for f in forecasts:
        gid = f['match_id']
        if gid in seen:
            raise ValueError('duplicate forecast ID')
        seen.add(gid)
        kickoff = timestamp(f['kickoff_utc'])
        created = timestamp(f['forecasted_at_utc'])
        if not created < kickoff or created > now:
            raise ValueError('forecast was not recorded before kickoff or is future-dated')
        p = [f['p_away'], f['p_draw'], f['p_home']]
        if any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 1 for v in p):
            raise ValueError('invalid probability')
        if abs(sum(p) - 1) > 0.000002:
            raise ValueError('probabilities do not sum to one')
        gender = f['cohort'].split('-')[0]
        if f['cohort'] not in {f'{g}-d{d}' for g in ('men', 'women') for d in (1, 2, 3)} or not gid.startswith(gender + '-'):
            raise ValueError('forecast cohort mismatch')
        g = finals.get(gid)
        if g is None:
            continue
        if any(g[k] != f[k] for k in ('home_team', 'away_team')) or g['gender'] != gender or g['source_game'] != f['source_game']:
            raise ValueError('forecast/final identity mismatch')
        if kickoff > now or g['date'] != kickoff.astimezone(ZoneInfo('America/New_York')).date().isoformat():
            quarantined.append({'match_id': gid, 'reason': 'final contradicts locked kickoff time or date; review schedule', 'kickoff_utc': f['kickoff_utc'], 'final_date': g['date']})
            continue
        outcome = 2 if g['home_goals'] > g['away_goals'] else 0 if g['away_goals'] > g['home_goals'] else 1
        best = max(p)
        winners = [i for i, v in enumerate(p) if v == best]
        scored.append({
            'match_id': gid, 'cohort': f['cohort'], 'model': f['model'],
            'outcome': ['away', 'draw', 'home'][outcome],
            'home_goals': g['home_goals'], 'away_goals': g['away_goals'],
            'log_loss': -math.log(max(p[outcome], 1e-15)),
            'brier_score': sum((v - int(i == outcome)) ** 2 for i, v in enumerate(p)),
            'correct_pick': outcome == winners[0] if len(winners) == 1 else None,
            'source_game': g['source_game'],
        })

    def summary(rows):
        decisive = [r for r in rows if r['correct_pick'] is not None]
        return {'scored': len(rows),
                'mean_log_loss': sum(r['log_loss'] for r in rows) / len(rows) if rows else None,
                'mean_brier_score': sum(r['brier_score'] for r in rows) / len(rows) if rows else None,
                'pick_accuracy': sum(r['correct_pick'] for r in decisive) / len(decisive) if decisive else None,
                'unambiguous_picks': len(decisive)}

    return {'schema_version': 1, 'status': 'prospective_research_only',
            'count_locked': len(forecasts), 'awaiting_final': len(forecasts) - len(scored) - len(quarantined),
            'quarantined_count': len(quarantined), 'quarantined': quarantined,
            'overall': summary(scored),
            'cohorts': {key: summary([r for r in scored if r['cohort'] == key]) for key in COHORTS},
            'scores': sorted(scored, key=lambda r: r['match_id']),
            'brier_definition': 'Sum of squared errors across away/draw/home; range 0 to 2.',
            'zero_probability_log_floor': 1e-15}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--now', help='Explicit timezone-aware scoring time')
    args = parser.parse_args()
    now = timestamp(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
    forecast_path = HERE / 'data/college-soccer-prospective.json'
    before = forecast_path.read_bytes()
    report = score_forecasts(read_json(forecast_path), read_json(HERE / 'data/college-soccer-elo-final-ledger.json'), now)
    report['forecast_archive_canonical_sha256'] = canonical_digest(read_json(forecast_path))
    if forecast_path.read_bytes() != before:
        raise RuntimeError('forecast archive changed during scoring')
    atomic_json(HERE / 'data/college-soccer-forecast-scores.json', report)
    print(f"Forecast scoring: {report['overall']['scored']} finals, {report['awaiting_final']} awaiting finals")


if __name__ == '__main__':
    main()

"""Audit Harrell's historical team logs and backtest Indiana boys basketball Elo."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime
from html import unescape
from itertools import groupby, product
from math import log, log1p
from pathlib import Path
import json
import re


TRAIN = (2022, 2023, 2024)
HOLDOUT = 2025
INITIAL_RATING = 1500.0


def plain(markup):
    return ' '.join(unescape(re.sub(r'<[^>]+>', ' ', markup)).split())


def observations(directory):
    games = defaultdict(list)
    schools = defaultdict(set)
    incomplete = Counter()
    for path in sorted(directory.glob('*.htm')):
        html = path.read_text(encoding='windows-1252', errors='replace')
        sections = re.split(r'(20\d\d)-\d\d SEASON', html)
        for year, section in zip(sections[1::2], sections[2::2]):
            year = int(year)
            if year not in (*TRAIN, HOLDOUT):
                continue
            record = re.search(r'Won (\d+), Lost (\d+)', section)
            if record is None:
                incomplete[year] += 1
                continue
            finals = []
            for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', section, re.S | re.I):
                cells = re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S | re.I)
                if len(cells) < 6:
                    continue
                date, site, _, outcome, score, other_score = map(plain, cells[:6])
                if outcome not in ('W', 'L') or not (score.isdigit() and other_score.isdigit()):
                    continue
                finals.append((date, site, cells[2], outcome, int(score), int(other_score)))
            wins, losses = map(int, record.groups())
            counts = Counter(final[3] for final in finals)
            if (wins, losses) != (counts['W'], counts['L']):
                incomplete[year] += 1
                continue
            schools[year].add(path.stem)
            for date, site, opponent, outcome, score, other_score in finals:
                link = re.search(r'''href=['"](?:/logs/)?([^/'"]+)\.htm['"]''', opponent, re.I)
                if not link or site not in ('', 'at', 'N') or ((score > other_score) != (outcome == 'W')):
                    continue
                opponent = link.group(1)
                month_day = datetime.strptime(date.replace('.', '').replace('Sept', 'Sep'), '%b %d')
                day = month_day.replace(year=year + (month_day.month < 7)).date().isoformat()
                home = 0 if site == 'N' else (-1 if site == 'at' else 1)
                team_a, team_b = sorted((path.stem, opponent))
                if path.stem != team_a:
                    score, other_score, home = other_score, score, -home
                games[year, day, team_a, team_b].append((path.stem, score, other_score, home))
    seasons = defaultdict(list)
    rejected = Counter()
    for (year, day, team_a, team_b), reports in sorted(games.items()):
        if len(reports) != 2 or {report[0] for report in reports} != {team_a, team_b} or reports[0][1:] != reports[1][1:]:
            rejected[year] += 1
            continue
        _, score_a, score_b, home = reports[0]
        seasons[year].append((day, team_a, team_b, score_a - score_b, home))
    return seasons, schools, incomplete, rejected


def replay(games, settings):
    k, court, margin_weight = settings
    ratings = defaultdict(lambda: INITIAL_RATING)
    forecasts = []
    for _, daily_games in groupby(games, key=lambda game: game[0]):
        changes = Counter()
        for _, team_a, team_b, margin, home in daily_games:
            advantage = ratings[team_a] - ratings[team_b] + home * court
            probability = 1 / (1 + 10 ** (-advantage / 400))
            won = margin > 0
            multiplier = 1 + margin_weight * log1p((abs(margin) - 1) / 8)
            movement = k * multiplier * (won - probability)
            changes[team_a] += movement
            changes[team_b] -= movement
            forecasts.append((probability, won, advantage, margin))
        ratings.update({team: ratings[team] + change for team, change in changes.items()})
    return forecasts


def metrics(forecasts, point_scale):
    count = len(forecasts)
    return {
        'games': count,
        'log_loss': -sum(log(max(1e-15, p if won else 1-p)) for p, won, _, _ in forecasts) / count,
        'spread_mae': sum(abs(advantage * point_scale - margin) for _, _, advantage, margin in forecasts) / count,
        'winner_accuracy': sum(0.5 if p == 0.5 else int((p > 0.5) == won) for p, won, _, _ in forecasts) / count,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    seasons, schools, incomplete, rejected = observations(args.archive)
    years = (*TRAIN, HOLDOUT)
    audit = {year: {'verified_finals': len(seasons[year]), 'complete_team_logs': len(schools[year]),
                    'incomplete_team_logs': incomplete[year], 'unconfirmed_or_conflicting_finals': rejected[year]}
             for year in years}
    if not all(seasons[year] for year in years):
        print(json.dumps(audit, indent=2))
        parser.error('at least one season has no reconciled finals')
    candidates = []
    baseline = (20, 0, 0)
    for settings in product((20, 36, 48, 64, 80, 96, 120), (0, 15, 30, 45, 60), (0, 0.5, 1, 1.5, 2, 2.5, 3, 4)):
        forecasts = [forecast for year in TRAIN for forecast in replay(seasons[year], settings)]
        point_scale = min(tuple(value / 1000 for value in range(20, 121, 5)),
                          key=lambda scale: sum(abs(advantage * scale - margin) for _, _, advantage, margin in forecasts))
        candidates.append((settings, point_scale, metrics(forecasts, point_scale)))
    best = min(candidates, key=lambda candidate: candidate[2]['log_loss'])
    comparison = {}
    for label, candidate in [('baseline', next(c for c in candidates if c[0] == baseline)), ('tuned', best)]:
        settings, point_scale, training = candidate
        comparison[label] = {
            'k': settings[0], 'home_court_elo_points': settings[1], 'margin_weight': settings[2],
            'elo_to_points': point_scale, 'training': training,
            'holdout': metrics(replay(seasons[HOLDOUT], settings), point_scale),
        }
    print(json.dumps({'coverage': audit, 'comparison': comparison}, indent=2))


if __name__ == '__main__':
    main()

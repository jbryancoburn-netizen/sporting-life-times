"""Publish confirmed varsity finals for schools in the Indiana RETRO register."""

import argparse
import calendar
import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from lxml import etree, html

DATA = Path('data')
HARRELL = 'https://scoreboard.homestead.com/boys/'
MAXPREPS = 'https://www.maxpreps.com/in/basketball/scores/'
SEASON_START = date(2026, 11, 23)
SEASON_END = date(2027, 4, 4)


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'SportingLifeTimes/1.0'}), timeout=15) as response:
        return html.fromstring(response.read())


def normalized(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())


def harrell_games(page, known):
    for row in page.xpath('//tr[td]'):
        cells = row.xpath('./td')
        if len(cells) < 5:
            continue
        names, ids = [], []
        for cell in (cells[0], cells[2]):
            name = ' '.join(cell.text_content().split())
            ids_found = cell.xpath('.//a/@href')
            match = re.search(r'logs([^/]+)\.htm$', ids_found[0]) if ids_found else None
            ids.append(match[1] if match and match[1] in known else None)
            names.append(name)
        if not any(ids):
            continue
        values = [' '.join(cell.text_content().split()) for cell in cells]
        score = re.fullmatch(r'(\d{1,3})\s*[-–]\s*(\d{1,3})(?:\s*\(?\d*OT\)?)?',
                             ' '.join(v for v in values[3:] if v), re.I)
        if not score:
            for value in values[3:]:
                score = re.fullmatch(r'(\d{1,3})\s*[-–]\s*(\d{1,3})', value)
                if score:
                    break
        points = None
        if score and re.fullmatch(r'(?:def(?:eats?|eated)?\.?|beat|over|>)', values[1], re.I):
            winner, loser = map(int, score.groups())
            if winner > loser:
                points = [winner, loser]
        yield ids, names, points


def maxpreps_finals(page, day):
    if not page.xpath(f'//time[starts-with(@datetime,"{day.isoformat()}T")]'):
        raise ValueError(f'MaxPreps did not confirm the requested date {day}')
    for game in page.xpath('//*[@data-contest-state="boxscore"]'):
        details = ' '.join(game.xpath('.//div[@class="details"]/text()')).strip()
        if not re.match(r'^Final\b', details, re.I):
            continue
        teams = game.xpath('.//ul[@class="teams"]/li')
        names = [team.xpath('string(./div[@class="name"])').strip() for team in teams]
        scores = [team.xpath('string(./div[@class="score"])').strip() for team in teams]
        links = game.xpath('./a/@href')
        if (len(names) == 2 and all(names) and all(s.isdecimal() for s in scores)
                and scores[0] != scores[1] and links and links[0].startswith('https://www.maxpreps.com/')):
            yield names, [int(s) for s in scores], links[0]


def matchup_key(ids, names):
    return tuple(sorted(team_id or normalized(name) for team_id, name in zip(ids, names)))


def identify(names, aliases, schedule):
    resolved = [aliases.get(normalized(name)) for name in names]
    candidates = []
    for ids, expected, _ in schedule:
        for order in ((0, 1), (1, 0)):
            if all((resolved[i] and resolved[i] == ids[j]) or
                   (not resolved[i] and normalized(names[i]) == normalized(expected[j]))
                   for i, j in enumerate(order)):
                candidates.append(([ids[j] for j in order], [expected[j] for j in order]))
    unique = {tuple(ids): (ids, expected) for ids, expected in candidates}
    return next(iter(unique.values())) if len(unique) == 1 else None


def finals(day, schools, schedule, aliases, has_harrell_page):
    harrell_url = HARRELL + f'day{calendar.month_abbr[day.month]}{day.day}.htm'
    maxpreps_url = MAXPREPS + f'?date={day}'
    games = {}
    errors = []
    try:
        harrell_rows = list(harrell_games(fetch(harrell_url), schools)) if has_harrell_page else []
        if has_harrell_page and not harrell_rows:
            errors.append(f'{day} John Harrell: no identifiable varsity fixtures on the day page')
        for ids, names, scores in harrell_rows:
            schedule.append((ids, names, scores))
            if scores:
                key = matchup_key(ids, names)
                games[key] = dict(teams=ids, names=names, scores=scores, source='John Harrell', url=harrell_url)
    except (OSError, ValueError, etree.LxmlError) as exc:
        errors.append(f'{day} John Harrell: {exc}')
    try:
        for names, scores, url in maxpreps_finals(fetch(maxpreps_url), day):
            match = identify(names, aliases, schedule)
            if match is None:
                continue
            ids, canonical_names = match
            key = matchup_key(ids, canonical_names)
            if key in games:
                old = games[key]
                if dict(zip((i or normalized(n) for i, n in zip(ids, canonical_names)), scores)) != dict(
                        zip((i or normalized(n) for i, n in zip(old['teams'], old['names'])), old['scores'])):
                    errors.append(f'{day} score disagreement for {canonical_names}')
                continue
            games[key] = dict(teams=ids, names=canonical_names, scores=scores, source='MaxPreps', url=url)
    except (OSError, ValueError, etree.LxmlError) as exc:
        errors.append(f'{day} MaxPreps: {exc}')
    return games, errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', type=date.fromisoformat)
    parser.add_argument('--output', type=Path, default=DATA / 'indiana-boys-results.json')
    args = parser.parse_args()
    edition = json.loads((DATA / 'indiana-boys-basketball.json').read_text())
    schools = {team['id']: team['school'] for team in edition['teams']}
    alias_sets = defaultdict(set)
    for key, name in schools.items():
        for alias in (key, name):
            alias_sets[normalized(alias)].add(key)
    aliases = {alias: next(iter(ids)) for alias, ids in alias_sets.items() if len(ids) == 1}
    schedule = defaultdict(list)
    for path in DATA.glob('indiana-boys-schedule-?a.json'):
        for team, games in json.loads(path.read_text()).items():
            if team not in schools:
                continue
            for day, _, opponent, *_ in games:
                opponent_id = opponent if opponent in schools else None
                schedule[day].append(([team, opponent_id], [schools[team], schools.get(opponent, opponent)], None))
    previous = json.loads(args.output.read_text()) if args.output.exists() else {'dates': {}}
    today = args.date or datetime.now(ZoneInfo('America/Indiana/Indianapolis')).date()
    last = min(today, SEASON_END)
    first = last if args.date else max(SEASON_START, last - timedelta(days=4))
    errors = []
    if first <= last and first >= SEASON_START and today <= SEASON_END + timedelta(days=7):
        # The calendar prevents probing nonexistent Harrell pages on off days.
        try:
            days = set(fetch(HARRELL + 'daysked.htm').xpath('//a/@href'))
        except (OSError, ValueError, etree.LxmlError) as exc:
            errors.append(f'John Harrell calendar: {exc}')
            days = set()
        for offset in range((last - first).days + 1):
            day = first + timedelta(days=offset)
            key = day.isoformat()
            dayfile = f'day{calendar.month_abbr[day.month]}{day.day}.htm'
            scheduled = schedule[day.strftime('%m-%d')]
            if dayfile not in days and not scheduled:
                continue
            games, warnings = finals(day, schools, list(scheduled), aliases, dayfile in days)
            errors.extend(warnings)
            existing = {matchup_key(g['teams'], g['names']): g for g in previous['dates'].get(key, [])}
            for matchup, game in games.items():
                if game['source'] == 'John Harrell' or existing.get(matchup, {}).get('source') != 'John Harrell':
                    existing[matchup] = game
            print(f'{day}: {len(games)} source-confirmed finals, {len(existing)} total stored')
            if existing:
                previous['dates'][key] = [existing[matchup] for matchup in sorted(existing)]
    args.output.write_text(json.dumps(previous, indent=2, sort_keys=True) + '\n')
    for error in errors:
        print(f'::warning::{error}')
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()

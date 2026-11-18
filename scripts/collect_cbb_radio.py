"""Collect game-specific radio links posted by official Division I athletics schedules."""
import concurrent.futures
import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from lxml import html

DATA = Path(__file__).resolve().parents[1] / 'data'
SEASON = '2026-27'
DATE = re.compile(r'\b(Oct|Nov|Dec|Jan|Feb|Mar|Apr)[a-z]*\.?\s+(\d{1,2})\b', re.I)
MONTHS = {name: i for i, name in enumerate(('jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'), 1)}


def read(name):
    return json.loads((DATA / name).read_text())


def calendar_url(raw, gender):
    url = urlsplit(raw)
    sport = '/sports/' + ('womens' if gender == 'women' else 'mens') + '-basketball/schedule/'
    return urlunsplit(('https', url.netloc, sport + SEASON, '', ''))


def calendar_sources():
    men = {str(t['espn_id']): t['url'] for t in read('mbb-official-school-schedule-sources.json')['teams']
           if t.get('url', '').startswith('https://') and t.get('espn_id')}
    women = {}
    for path in sorted(DATA.glob('ncaaw-official-school-verification-batch-*.json')):
        for row in json.loads(path.read_text())['rows']:
            if row.get('source_url', '').startswith('https://'):
                women.setdefault(str(row['team_id']), row['source_url'])
    registry = read('ncaaw-2026-27-teams.json')
    rows = registry.get('teams', []) if isinstance(registry, dict) else registry
    women_ids = {str(t.get('team_id') or t.get('espn_id') or t.get('id')) for t in rows}
    for ident, url in men.items():
        if ident in women_ids:
            women.setdefault(ident, url)
    return [(gender, ident, calendar_url(url, gender))
            for gender, entries in [('men', men), ('women', women)] for ident, url in entries.items()]


def visible(node):
    return ' '.join(node.text_content().split())


def game_date(value):
    match = DATE.search(value)
    if not match:
        return ''
    month = MONTHS[match[1].lower()[:3]]
    return dt.date(2026 if month >= 10 else 2027, month, int(match[2])).isoformat()


def parse(document, url):
    cards = document.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," s-game-card ") or contains(concat(" ",normalize-space(@class)," ")," sidearm-schedule-game ")]')
    findings = {}
    for card in cards:
        dates = card.xpath('.//*[contains(@data-test-id,"header-game-date") or contains(@class,"sidearm-schedule-game-opponent-date")]')
        opponents = card.xpath('.//*[contains(@data-test-id,"header-team-opponent-link") or contains(@class,"sidearm-schedule-game-opponent-name")]')
        if not dates or not opponents:
            continue
        day = game_date(visible(dates[0]))
        opponent = visible(opponents[0])
        if not day or not opponent:
            continue
        radio = []
        for element in card.xpath('.//*[contains(@class,"coverage-radio-content") or contains(@class,"header__tv-and-radio") or contains(@class,"button-icon-audio")]'):
            label = visible(element)
            match = re.search(r'\bRadio\s*:\s*(.+)', label, re.I)
            if match:
                label = match[1].strip()
            elif 'coverage-radio-content' not in element.get('class', '') and 'button-icon-audio' not in element.get('class', ''):
                continue
            if not label or len(label) > 110:
                continue
            links = [element] if element.tag == 'a' else element.xpath('.//a[@href]')
            target = next((urljoin(url, a.get('href', '')) for a in links if a.get('href')), '')
            if not target.startswith('https://'):
                target = ''
            entry = [label, target]
            if entry not in radio:
                radio.append(entry)
        # A named radio listing and the same card's Listen button describe the same broadcast.
        player = next((link for label, link in radio if label.lower() == 'listen' and link), '')
        named = [[label, link or player] for label, link in radio if label.lower() not in {'listen','radio'}]
        entries = named or [['Official game audio', player]] if player else named
        if entries:
            findings.setdefault(day, {})[opponent] = entries
    return findings, bool(cards)


def collect(job):
    gender, ident, url = job
    try:
        request = Request(url, headers={'User-Agent': 'Sporting Life and Times radio calendar / public listings'})
        with urlopen(request, timeout=12) as response:
            # Ignore redirects to landing pages or a different season.
            if SEASON not in response.url or '-basketball/schedule' not in response.url:
                return gender, ident, None
            document = html.fromstring(response.read(8_000_000))
        games, parsed = parse(document, url)
        return gender, ident, {'source': url, 'games': games} if parsed else None
    except (OSError, ValueError):
        return gender, ident, None


def main():
    jobs = calendar_sources()
    result = {'men': {}, 'women': {}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        for gender, ident, team in pool.map(collect, jobs):
            if team:
                result[gender][ident] = team
    for gender, teams in result.items():
        payload = {'season': SEASON, 'attempted': sum(job[0] == gender for job in jobs), 'teams': teams}
        (DATA / f'cbb-radio-calendar-{gender}.json').write_text(json.dumps(payload, separators=(',', ':')) + '\n')
        print(gender, payload['attempted'], len(teams), sum(bool(t['games']) for t in teams.values()),
              sum(len(t['games']) for t in teams.values()), flush=True)


if __name__ == '__main__':
    main()

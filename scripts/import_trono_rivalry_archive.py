"""Build the dated men's rivalry supplement from saved Saint Michael's archive pages.

Download Translation.htm and the 1949–50 through 1983–84 w/dates files
(including linked, dated invitational files), plus the rivalry's teams.csv
and TeamSpellings.csv, into one directory. Pass that directory as argv[1].
"""
import collections
import csv
from datetime import date
import gzip
import html
import json
from pathlib import Path
import re
import sys

SOURCE = 'https://academics.smcvt.edu/jtrono/BBallArchive.htm'
CONTINUOUS_PROGRAMS = {
    'WTS':'1446', 'ETS':'1190', 'TEA':'1426', 'NAR':'1319', 'SAL':'1375',
    'NEL':'1419', 'SWL':'1418', 'BAP':'1149', 'TSA':'1427', 'W&M':'1456',
}
TOURNAMENTS = {'nct':'National Campus Tournament', 'ncit':'National Commissioners Invitational', 'cca':'Collegiate Commissioners Association Tournament'}


def normalize(value):
    return re.sub('[^a-z0-9]', '', value.lower().replace('&', 'and'))


def text(path):
    return html.unescape(re.sub(r'<[^>]+>', '', path.read_text(encoding='cp1252')))


def table(path):
    with path.open(encoding='cp1252', newline='') as source:
        return list(csv.DictReader(source))


def build(directory):
    aliases = collections.defaultdict(set)
    for filename, field in [('teams.csv', 'TeamName'), ('TeamSpellings.csv', 'TeamNameSpelling')]:
        for row in table(directory / filename):
            aliases[normalize(row[field])].add(row['TeamID'])
    codes = dict(re.findall(r'^([A-Z&]{3}) (.+)$', text(directory / 'Translation.htm'), re.M))
    codes.update({'W&M':'William & Mary', 'W&L':'Washington & Lee'})
    schools, crosswalk = {}, {}
    for code, school in codes.items():
        ids = aliases[normalize(school)]
        team = CONTINUOUS_PROGRAMS.get(code) or (next(iter(ids)) if len(ids) == 1 else 'trono:'+code)
        crosswalk[code] = team
        if team.startswith('trono:'):
            schools[team] = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', school)

    archive, excluded = collections.defaultdict(list), collections.Counter()
    seen = set()
    files = sorted(directory.glob('*.htm'))
    assert sum(bool(re.fullmatch(r'\d\d_\d\d_dts', p.stem)) for p in files) == 35
    for path in files:
        match = re.fullmatch(r'(\d\d)_\d\d_(dts|nct|ncit|cca)', path.stem.lower())
        if not match:
            continue
        year = 1900 + int(match[1])
        if not 1949 <= year <= 1983:
            continue
        raw = path.read_text(encoding='cp1252')
        raw = re.split(r"<body\b[^>]*>", raw, maxsplit=1, flags=re.I)[-1]
        for line in re.split(r'<br\s*/?>|</p>', raw, flags=re.I):
            line = html.unescape(re.sub(r'<[^>]+>', '', line))
            row = re.match(r'^\s*(\d{3})\s+([A-Z&]{3})\s+(\d+)\s+([A-Z&]{3})\s+(\d+)\s+[HAN?]', line)
            if not row:
                continue
            day, first, first_score, second, second_score = row.groups()
            a, b = crosswalk.get(first), crosswalk.get(second)
            sa, sb = int(first_score), int(second_score)
            if not a or not b or a == b or sa == sb:
                excluded['team or score'] += 1
                continue
            try:
                offset = int(day[0])
                if not 1 <= offset <= 7:
                    raise ValueError()
                month = (offset + 8) % 12 + 1
                played = date(year + (month < 10), month, int(day[1:])).isoformat()
            except ValueError:
                excluded['date'] += 1
                continue
            key = (played, *sorted([(a, sa), (b, sb)]))
            if key in seen:
                excluded['duplicate'] += 1
                continue
            seen.add(key)
            archive[year].append([played[5:], a, b, sa, sb, TOURNAMENTS.get(match[2], '')])
    assert len(archive) == 35
    return archive, schools, excluded


if __name__ == '__main__':
    archive, schools, excluded = build(Path(sys.argv[1]))
    for start in range(1949, 1984, 5):
        seasons = {y: sorted(archive[y]) for y in range(start, start+5)}
        document = json.dumps({'source':SOURCE, 'schools':schools, 'seasons':seasons}, separators=(',', ':'))
        target = Path(f'data/ncaam-rivalry-trono-{start}.json.gz')
        target.write_bytes(gzip.compress(document.encode(), mtime=0))
        print(target, sum(map(len, seasons.values())), target.stat().st_size)
    print('Excluded rows:', dict(excluded))

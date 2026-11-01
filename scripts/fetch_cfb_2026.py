#!/usr/bin/env python3
"""Refresh the audited results ledger and durable CFB desk feeds. No workflow changes."""
import concurrent.futures, datetime, json, pathlib, urllib.request
BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/'
NOW = datetime.datetime.now(datetime.timezone.utc)
PATH = pathlib.Path('data/cfb-2026-results.json')

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'SportingLifeTimes/1.0'})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)

def main():
    previous = json.loads(PATH.read_text()) if PATH.exists() else {}
    sources = [(f'week {w}', BASE + f'scoreboard?dates=2026&seasontype=2&week={w}&groups=80&limit=400') for w in range(18)]
    sources += [('opening ' + d, BASE + f'scoreboard?dates={d}&groups=80&limit=400') for d in ('20260829', '20260830', '20260831')]
    games, events, errors = {}, {}, []
    def load(source):
        label, url = source
        return label, fetch(url)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(load, s): s[0] for s in sources}
        for future in concurrent.futures.as_completed(futures):
            try:
                label, data = future.result()
                for e in data.get('events', []):
                    events[str(e['id'])] = e
                    if not e.get('status', {}).get('type', {}).get('completed'):
                        continue
                    c = e.get('competitions', [{}])[0]
                    sides = c.get('competitors', [])
                    if len(sides) != 2 or any(not s.get('team', {}).get('id') or s.get('score') is None for s in sides):
                        raise ValueError('Malformed final ' + str(e.get('id')))
                    game = {'id': str(e['id']), 'date': e['date'], 'teams': [{'id': str(s['team']['id']), 'name': s['team'].get('displayName'), 'score': int(s['score']), 'homeAway': s.get('homeAway')} for s in sides], 'neutral': c.get('neutralSite', False)}
                    if game['id'] in games and games[game['id']] != game:
                        errors.append('Conflicting game ' + game['id'])
                    games[game['id']] = game
            except Exception as exc:
                errors.append(f'{futures[future]}: {exc}')
    # Never overwrite the last good season with a partial or regressed import.
    missing = {g['id'] for g in previous.get('games', [])} - games.keys()
    if missing:
        errors.append(f'{len(missing)} previously published finals disappeared')
    if errors or not games:
        raise SystemExit('Results unchanged: ' + '; '.join(errors or ['empty import']))
    ordered = sorted(games.values(), key=lambda g: (g['date'], g['id']))
    report = {'season': 2026, 'baseline': 1500, 'source': 'ESPN completed-game scoreboards', 'generated_at': NOW.isoformat(), 'games': len(ordered), 'first_game': ordered[0]['date'], 'last_game': ordered[-1]['date'], 'errors': [], 'complete': True}
    feeds = dict(previous.get('feeds', {}))
    for name, url in [('standings', 'https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=2026&group=80'), ('teams', BASE + 'teams?limit=1000&groups=80')]:
        try:
            data = fetch(url)
            if not data.get('children' if name == 'standings' else 'sports'):
                raise ValueError('Empty feed')
            feeds[name] = {'updated_at': NOW.isoformat(), 'source_url': url, 'data': data}
        except Exception as exc:
            print(f'{name}: retaining prior snapshot ({exc})')
    # Save the entire current season schedule for date navigation and browser fallbacks.
    feeds['scoreboard'] = {'updated_at': NOW.isoformat(), 'source_url': BASE + 'scoreboard', 'data': {'events': sorted(events.values(), key=lambda e: (e['date'], e['id']))}}
    # Publish only fields used by the newspaper, never entire provider payloads.
    def team(t):
        result = {k: v for k, v in t.items() if k in ('id', 'displayName', 'shortDisplayName', 'color', 'alternateColor', 'logo')}
        if t.get('logos'):
            result['logos'] = [{'href': t['logos'][0]['href']}]
        return result
    def group(g):
        result = {'name': g.get('name'), 'children': [group(c) for c in g.get('children', [])]}
        if g.get('standings', {}).get('entries'):
            result['standings'] = {'entries': [{'team': team(e['team']), 'stats': [s for s in e.get('stats', []) if s.get('name') in ('overall', 'vs. Conf.')]} for e in g['standings']['entries']]}
        return result
    if 'standings' in feeds:
        feeds['standings']['data'] = group(feeds['standings']['data'])
    if 'teams' in feeds:
        raw = feeds['teams']['data']['sports'][0]['leagues'][0]['teams']
        feeds['teams']['data'] = {'sports': [{'leagues': [{'teams': [{'team': team(x['team'])} for x in raw]}]}]}
    compact = []
    for e in events.values():
        c = e.get('competitions', [{}])[0]
        compact.append({'id': e['id'], 'date': e['date'], 'status': {'type': e.get('status', {}).get('type', {})}, 'competitions': [{'competitors': [{**{k: v for k, v in t.items() if k in ('homeAway', 'score')}, 'team': team(t.get('team', {}))} for t in c.get('competitors', [])], 'neutralSite': c.get('neutralSite'), 'venue': {'fullName': c.get('venue', {}).get('fullName')}, 'broadcasts': c.get('broadcasts', [])}]})
    feeds['scoreboard']['data']['events'] = sorted(compact, key=lambda e: (e['date'], e['id']))
    payload = {'audit': report, 'games': ordered, 'feeds': feeds}
    temp = PATH.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, separators=(',', ':')) + '\n')
    temp.replace(PATH)
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()

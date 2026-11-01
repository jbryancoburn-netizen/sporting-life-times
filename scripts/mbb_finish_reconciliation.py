#!/usr/bin/env python3
"""Reconcile exact program aliases against reciprocal, dated official game rows.

No substring matching, default home arenas, guessed TV or inferred time zones.
Existing event IDs survive; every changed identity retains its original label.
"""
import collections
import copy
import datetime
import json
import pathlib
import re

D = pathlib.Path(__file__).resolve().parents[1] / 'data'


def key(value):
    text = str(value or '').casefold().replace('&', 'and')
    text = re.sub(r'\b(?:university|college|the|of|at)\b', ' ', text)
    text = re.sub(r'\bsaint\b', 'st', text)
    return re.sub('[^a-z0-9]', '', text)


def registry():
    teams = json.loads((D / 'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
    branding = json.loads((D / 'mbb-branding.json').read_text())['teams']
    logos = json.loads((D / 'mbb-logo-registry.json').read_text())['teams']
    aliases = collections.defaultdict(set)
    byid = {str(t['espn_id']): t for t in teams}
    for tid, team in byid.items():
        names = [team['name'], team.get('espn_name')]
        names += [branding.get(tid, {}).get('abbreviation')]
        names += [logos.get(tid, {}).get(x) for x in ('school', 'display_name', 'provider_team_name')]
        for name in names:
            if name:
                aliases[key(name)].add(tid)
    # Institution aliases, used only with independent reciprocal fixture proof.
    reviewed = {
        '2755': ['Grambling State'], '2545': ['Southeastern Louisiana'],
        '41': ['Connecticut'], '2115': ['Central Connecticut State', 'CCSU'],
        '2026': ['Appalachian State'], '399': ['Albany', 'University at Albany'],
        '2349': ['Massachusetts Lowell'], '2856': ['Cal Baptist'],
        '236': ['Tennessee at Chattanooga'], '2582': ['Southern'],
        '292': ['Texas Rio Grande Valley'], '2433': ['Louisiana-Monroe', 'UL Monroe'],
        '166': ['New Mexico State', 'NM State'],
        '2678': ['Virginia Military Institute'], '2567': ['Southern Methodist'],
        '2628': ['Texas Christian'], '2885': ['New Jersey Institute of Technology'],
        '55': ['Jacksonville State', 'Jax State'],
        '2638': ['Texas at El Paso'],
        '309': ['UL-Lafayette'], '2277': ['Houston Christian', 'HCU'],
    }
    for tid, names in reviewed.items():
        if tid in byid:
            for name in names:
                aliases[key(name)].add(tid)
    return byid, aliases


def main():
    teams, aliases = registry()
    resolve = lambda name: next(iter(aliases[key(name)])) if len(aliases[key(name)]) == 1 else ''
    evidence = {}
    reciprocal = collections.defaultdict(list)
    for tid in teams:
        path = D / 'mbb-official-game-evidence' / (tid + '.json')
        if not path.exists():
            continue
        facts = json.loads(path.read_text())
        evidence[tid] = facts
        for row in facts['rows']:
            oid = resolve(row['opponent'])
            if oid and oid != tid:
                reciprocal[(row['date'], tid, oid)].append((row, facts['source_url']))
    changes = []
    conflicts = []
    for tid in teams:
        path = D / 'mbb-schedules-2026-27' / (tid + '.json')
        doc = json.loads(path.read_text())
        original = copy.deepcopy(doc)
        for event in doc['events']:
            comp = event['competitions'][0]
            ps = comp['competitors']
            own = next((p for p in ps if str(p['team'].get('id')) == tid), None)
            if own is None or len(ps) != 2:
                continue
            other = next(p for p in ps if p is not own)
            obj = other['team']
            oldid = str(obj.get('id') or '')
            label = obj.get('displayName') or event.get('name', '')
            oid = resolve(label)
            date = event['date'][:10]
            if not oid or oid == tid:
                continue
            ownproof = reciprocal.get((date, tid, oid), [])
            reverseproof = reciprocal.get((date, oid, tid), [])
            # A unique exact institution alias on the school's own dated row
            # also establishes identity. Conflicting existing IDs stay untouched.
            proof = ownproof if oldid in ('', oid) and len(ownproof) == 1 else reverseproof
            if len(proof) != 1:
                continue
            row, url = proof[0]
            fields = []
            if oldid != oid:
                if oldid:
                    conflicts.append({'team': tid, 'event_id': event['id'], 'old_id': oldid,
                                      'candidate_id': oid, 'source_url': url})
                    continue
                obj['id'] = oid
                obj['original_school_label'] = label
                event['official_opponent_identity_source'] = url
                event['official_opponent_identity_method'] = 'exact_alias_and_unique_dated_official_fixture'
                fields.append('opponent_id')
            if not obj.get('logo'):
                obj['logo'] = 'https://a.espncdn.com/i/teamlogos/ncaa/500/' + oid + '.png'
                fields.append('logo')
            venue = comp.setdefault('venue', {})
            arena = row.get('arena', '').strip()
            # Generic "Arena"/"Center" parse fragments are not named venues.
            if arena and len(arena.split()) > 1 and not re.search(r'\bTBA|TBD\b', arena, re.I):
                if not venue.get('arenaName') or venue['arenaName'].lower() in ('arena', 'center', 'centre', 'gym'):
                    venue.update(arenaName=arena, arena_source_url=url,
                                 arena_source_type='reciprocal_official_game')
                    fields.append('arena')
            city = row.get('city', '').strip()
            if city and not venue.get('official_school_city') and not venue.get('address', {}).get('city'):
                venue.update(official_school_city=city, city_source_url=url)
                fields.append('city')
            if row.get('tv') and not (comp.get('broadcasts') or event.get('broadcasts')):
                comp['broadcasts'] = [{'names': [row['tv']], 'source_url': url}]
                event['broadcast_source_url'] = url
                fields.append('broadcast')
            if not event.get('site_verified') and row.get('site_explicit') and row.get('site') in ('home', 'away', 'neutral'):
                side = row['site']
                ownside = side if proof is ownproof else {'home': 'away', 'away': 'home', 'neutral': 'neutral'}[side]
                own['homeAway'] = ownside
                other['homeAway'] = {'home': 'away', 'away': 'home', 'neutral': 'neutral'}[ownside]
                event.update(site_verified=True, neutralSite=side == 'neutral', site_source_url=url)
                fields.append('site')
            if fields:
                changes.append({'team': tid, 'event_id': event['id'], 'date': date,
                                'opponent_id': oid, 'fields': fields, 'source_url': url})
        if doc != original:
            path.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n')
    report = {'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'summary': {'schools_scanned': len(teams),
                          'schools_changed': len({x['team'] for x in changes}),
                          'fields': dict(collections.Counter(f for x in changes for f in x['fields'])),
                          'identity_conflicts_retained_for_review': len(conflicts)},
              'changes': changes, 'conflicts': conflicts}
    (D / 'mbb-finish-reconciliation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report['summary'], indent=2))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Cheap rolling, verified D-I men's 2026-27 finals ingestion for RETRO.
Collect only completed games from current and previous 2 Eastern days.
Retain all previously verified finals; never invent teams, scores, or venues.
"""
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data/mbb-retro-live-finals.json'
TEAM_MAP = {str(t['espn_id']): t['id'] for t in json.loads(
    (ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text()
)['teams'] if t.get('espn_id')}
BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
EASTERN = ZoneInfo('America/New_York')

def valid(event):
    status = event.get('status', {}).get('type', {})
    if status.get('completed') is not True:
        return None
    season = event.get('season') or {}
    if season.get('year') not in (2027, None) or season.get('type') not in (2,3,None):
        return None
    competition = (event.get('competitions') or [{}])[0]
    entries = competition.get('competitors') or []
    home = next((x for x in entries if x.get('homeAway') == 'home'), None)
    away = next((x for x in entries if x.get('homeAway') == 'away'), None)
    if not home or not away:
        return None
    home_id = TEAM_MAP.get(str((home.get('team') or {}).get('id') or ''))
    away_id = TEAM_MAP.get(str((away.get('team') or {}).get('id') or ''))
    if not home_id or not away_id or home_id == away_id:
        return None
    try:
        hs, ass = int(home['score']), int(away['score'])
    except (KeyError, ValueError, TypeError):
        return None
    if hs < 1 or ass < 1 or hs == ass:
        return None
    try:
        date = datetime.fromisoformat(event['date'].replace('Z','+00:00')).astimezone(EASTERN).date().isoformat()
    except (KeyError,ValueError,TypeError):
        return None
    if not '2026-11-01' <= date <= '2027-04-30':
        return None
    event_id = str(event.get('id') or '')
    if not event_id.isdigit():
        return None
    neutral = competition.get('neutralSite')
    return dict(id='espn:'+event_id, date=date, home_id=home_id, away_id=away_id,
                home_score=hs, away_score=ass, neutral=neutral is True,
                site_verified=isinstance(neutral,bool),
                source='ESPN completed D-I scoreboard', source_event_id=event_id)

def main():
    old = json.loads(TARGET.read_text()) if TARGET.exists() else {}
    collected = {x['id']:x for x in old.get('games',[]) if x.get('id')}
    # NCAA-origin data, already identity-matched to the ESPN fixture by the
    # newsroom's independent crosscheck. A provider's stale score must not
    # overwrite an official completed-game result.
    official = {}
    snapshot_path = ROOT / 'data/mbb-live.json'
    if snapshot_path.exists():
        published = json.loads(snapshot_path.read_text())
        crosscheck = published.get('ncaa_crosscheck') or {}
        for g in crosscheck.get('games', []):
            eid = str(g.get('espn_id') or '')
            aid, hid = str(g.get('away_id') or ''), str(g.get('home_id') or '')
            day = str(g.get('day') or '')
            a, h = g.get('away_score'), g.get('home_score')
            if (g.get('phase') != 'final' or not eid.isdigit() or
                aid not in TEAM_MAP or hid not in TEAM_MAP or aid == hid or
                not isinstance(a, int) or not isinstance(h, int) or
                a <= 0 or h <= 0 or a == h or
                not ('2026-11-01' <= day <= '2027-04-30')):
                continue
            candidate = dict(id='espn:'+eid, date=day,
                             home_id=TEAM_MAP[hid], away_id=TEAM_MAP[aid],
                             home_score=h, away_score=a, neutral=True,
                             site_verified=False,
                             source='verified NCAA-origin final crosscheck',
                             source_event_id=eid)
            official[candidate['id']] = candidate
            previous = collected.get(candidate['id'])
            if previous:
                for key in ('date', 'home_id', 'away_id'):
                    if previous.get(key) != candidate[key]:
                        raise ValueError('NCAA fixture identity conflict: '+candidate['id'])
            collected[candidate['id']] = candidate
    now = datetime.now(timezone.utc)
    today = now.astimezone(EASTERN).date()
    failures = []
    queried = 0
    new = 0
    for offset in range(3):
        day = (today-timedelta(days=offset))
        if not ('2026-11-01' <= day.isoformat() <= '2027-04-30'):
            continue
        url = BASE+'?groups=50&limit=1000&dates='+day.strftime('%Y%m%d')
        try:
            req = urllib.request.Request(url,headers={'User-Agent':'SportingLifeTimes/1.0','Accept':'application/json'})
            with urllib.request.urlopen(req,timeout=18) as response:
                payload=json.load(response)
            if not isinstance(payload.get('events'),list):
                raise ValueError('Invalid scoreboard event list')
            queried += 1
            for event in payload['events']:
                row = valid(event)
                if not row:
                    continue
                previous = collected.get(row['id'])
                if row['id'] in official:
                    for key in ('home_id', 'away_id', 'date'):
                        if row[key] != official[row['id']][key]:
                            raise ValueError('ESPN versus NCAA fixture identity conflict: '+row['id'])
                    if (row['home_score'], row['away_score']) != (
                        official[row['id']]['home_score'], official[row['id']]['away_score']):
                        failures.append(day.isoformat()+': ESPN score differs from NCAA official final for '+row['id'])
                    # Keep independently verified NCAA scores (and conservative
                    # neutral venue handling) regardless of ESPN cache state.
                    continue
                if previous:
                    for k in ('home_id','away_id','home_score','away_score','date'):
                        if previous[k] != row[k]:
                            raise ValueError('Published final revised: '+row['id']+' '+k)
                    if previous.get('site_verified') and not row.get('site_verified'):
                        continue
                else:
                    new += 1
                collected[row['id']] = row
        except (OSError, ValueError, TypeError, KeyError) as exc:
            failures.append(day.isoformat()+': '+str(exc)[:140])
    games = sorted(collected.values(),key=lambda x:(x['date'],x['id']))
    if not queried and '2026-11-01' <= today.isoformat() <= '2027-04-30':
        if not old.get('games') and not official:
            raise SystemExit('All current NCAA final-score sources failed with no preserved history: '+str(failures))
        print('WARN: ESPN provider unavailable; retaining independently verified finals:',failures)
    output = {'season':'2026-27','source':'Verified NCAA-origin results preferred over ESPN completed D-I scoreboard',
              'games':games, 'score_conflicts':failures}
    if not old or old.get('games') != games or old.get('source') != output['source']:
        TARGET.write_text(json.dumps(output,indent=2)+'\n')
    print('MBB verified finals:',len(games),'new:',new,'scoreboard days checked:',queried,'errors:',failures)
if __name__=='__main__':
    main()

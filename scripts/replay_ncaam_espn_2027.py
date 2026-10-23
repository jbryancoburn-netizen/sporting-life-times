#!/usr/bin/env python3
"""Independently replay NCAA D-I Elo from attributed ESPN FINAL scoreboards.

Never imports third-party ratings. Every calendar day must fetch successfully.
Keep 365 canonical IDs (including a pending NCAA ID) and replay only finals.
"""
import argparse
import json
import math
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
OPENING = date(2026, 11, 2)
EASTERN = ZoneInfo('America/New_York')

def fetch_day(day):
    url = f'{BASE_URL}?dates={day:%Y%m%d}&groups=50&limit=500'
    req = urllib.request.Request(url, headers={'User-Agent':'SportingLifeTimes/1.0','Accept':'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = json.loads(response.read(10000000))
    if not isinstance(payload, dict) or not isinstance(payload.get('events'), list):
        raise ValueError(f'Invalid ESPN scoreboard on {day}')
    return {'day':day.isoformat(), 'url':url, 'events':payload['events']}

def collect(start, through, fetcher=fetch_day):
    if through < start:
        return []
    days = [start+timedelta(days=n) for n in range((through-start).days+1)]
    # Fetch failures propagate: never label incomplete provider data complete.
    with ThreadPoolExecutor(max_workers=5) as executor:
        out = list(executor.map(fetcher, days))
    if len(out) != len(days):
        raise ValueError('Incomplete ESPN scoreboard date coverage')
    for day, item in zip(days, out):
        if item.get('day') != day.isoformat() or not isinstance(item.get('events'), list):
            raise ValueError(f'Scoreboard missing or mismatched for {day}')
    return out

def game_records(days, crosswalk, today=None):
    today = today or datetime.now(EASTERN).date()
    teams = crosswalk['teams']
    if len(teams)!=365 or len({t['id'] for t in teams})!=365 or len({str(t['espn_id']) for t in teams})!=365:
        raise ValueError('Crosswalk requires 365 unique NCAA and ESPN IDs')
    by_espn = {str(t['espn_id']):t['id'] for t in teams}
    results, excluded = {}, Counter()
    for item in days:
        request_day = date.fromisoformat(item['day'])
        for event in item['events']:
            state = (event.get('status') or {}).get('type') or {}
            if state.get('completed') is not True or state.get('name') != 'STATUS_FINAL':
                excluded['not_final']+=1
                continue
            eid = str(event.get('id') or '')
            if not eid.isdigit():
                raise ValueError(f'Missing ESPN final event ID on {request_day}')
            try:
                timestamp = datetime.fromisoformat(event['date'].replace('Z','+00:00'))
                if timestamp.tzinfo is None:
                    raise ValueError('Timezone missing')
                local_day = timestamp.astimezone(EASTERN).date()
                if local_day != request_day:
                    continue
                if local_day > today:
                    raise ValueError('Future-dated final')
                comp = event['competitions'][0]
                players = comp['competitors']
                if len(players)!=2: raise ValueError('Expected two competing teams')
                home = next(x for x in players if x.get('homeAway')=='home')
                away = next(x for x in players if x.get('homeAway')=='away')
                home_id = by_espn.get(str(home['team']['id']))
                away_id = by_espn.get(str(away['team']['id']))
                if not home_id or not away_id:
                    excluded['non_d1_or_unmapped']+=1
                    continue
                hs, aws = int(home['score']), int(away['score'])
                if hs<0 or aws<0 or hs==aws or home_id==away_id:
                    raise ValueError('Invalid basketball final')
            except (IndexError, StopIteration, KeyError, TypeError, ValueError) as exc:
                raise ValueError(f'Invalid ESPN final {eid}: {exc}') from exc
            row = {'id':'espn:'+eid, 'date':local_day.isoformat(), 'timestamp':timestamp.isoformat(),
                   'home':home_id, 'away':away_id, 'home_score':hs, 'away_score':aws,
                   'neutral_site_reported':comp.get('neutralSite'),
                   'provider':'ESPN completed scoreboard',
                   'source_url':f'https://www.espn.com/mens-college-basketball/game/_/gameId/{eid}'}
            if eid in results and results[eid] != row:
                raise ValueError('Conflicting duplicate ESPN completed event '+eid)
            results[eid]=row
    return sorted(results.values(), key=lambda x:(x['timestamp'],x['id'])), dict(excluded)

def replay(pre, crosswalk, days, today=None):
    rows = pre['rankings']
    if len(rows)!=365 or len({t['team_id'] for t in rows})!=365:
        raise ValueError('Complete 365-school independent preseason baseline required')
    initial = {x['team_id']:float(x['elo']) for x in rows}
    if set(initial) != {t['id'] for t in crosswalk['teams']}:
        raise ValueError('Source crosswalk does not match preseason team universe')
    games, excluded = game_records(days,crosswalk,today)
    ratings=initial.copy()
    counts=Counter()
    for g in games:
        h,a=g['home'],g['away']
        p=1/(1+10**(-(ratings[h]-ratings[a])/400))
        margin=abs(g['home_score']-g['away_score'])
        shift=24*(1+.55*math.log10(1+margin))*(int(g['home_score']>g['away_score'])-p)
        g['home_elo_before']=round(ratings[h],6)
        g['away_elo_before']=round(ratings[a],6)
        g['home_win_probability']=round(p,8)
        ratings[h]+=shift
        ratings[a]-=shift
        g['home_change']=round(shift,6)
        g['home_elo_after']=round(ratings[h],6)
        g['away_elo_after']=round(ratings[a],6)
        counts[h]+=1
        counts[a]+=1
    if abs(sum(initial.values())-sum(ratings.values()))>1e-6:
        raise AssertionError('NCAA Elo conservation failure')
    meta={x['team_id']:x for x in rows}
    order=sorted(ratings,key=lambda x:(-ratings[x],x))
    return {'model':'slat-ncaam-d1-elo-v1', 'season':'2026-27',
            'status':'provisional-current-venue-neutral', 'team_count':365,
            'games_played':len(games), 'preseason_seed':('data/ncaam-2026-27-preseason-roster-informed.json'
                              if pre.get('preseason_roster_informed') is True
                              else 'data/ncaam-2026-27-preseason-provisional.json'),
            'preseason_roster_adjusted':pre.get('preseason_roster_informed') is True,
            'prediction_policy':'Independently calculated; venue-neutral pending calibrated court advantage',
            'provider':'ESPN final results; independent Elo calculations',
            'date_coverage':{'start':days[0]['day'] if days else None,
                             'end':days[-1]['day'] if days else None,
                             'days_checked':len(days), 'complete':True},
            'excluded':excluded,
            'rankings':[{'rank':i,'team_id':uid,'team':meta[uid]['team'],
                         'conference':meta[uid].get('conference'),
                         'elo':round(ratings[uid],4),'games':counts[uid]}
                        for i,uid in enumerate(order,1)],
            'events':games}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--through',type=date.fromisoformat,default=datetime.now(EASTERN).date())
    parser.add_argument('--baseline',type=Path,default=Path('data/ncaam-2026-27-preseason-roster-informed.json'))
    parser.add_argument('--crosswalk',type=Path,default=Path('data/ncaam-2026-27-espn-team-crosswalk.json'))
    parser.add_argument('--output',type=Path,default=Path('data/ncaam-2026-27-current-provisional.json'))
    parser.add_argument('--readiness',type=Path,default=Path('data/ncaam-source-readiness.json'))
    args=parser.parse_args()
    if args.through<OPENING:
        print('Season begins Nov 2, 2026; existing preseason rankings remain published')
        return
    if args.through>datetime.now(EASTERN).date():
        raise ValueError('Cannot replay future dates')
    days=collect(OPENING,args.through)
    baseline=json.loads(args.baseline.read_text(encoding='utf-8'))
    crosswalk=json.loads(args.crosswalk.read_text(encoding='utf-8'))
    result=replay(baseline,crosswalk,days,args.through)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    readiness={'season':'2026-27','ready':True,'score_source':'ESPN final scoreboards',
               'games':result['games_played'],'teams':365,'checked_days':len(days),
               'source_url':BASE_URL,'note':'Independent provisional venue-neutral Elo'}
    args.readiness.write_text(json.dumps(readiness,indent=2)+'\n',encoding='utf-8')
    print('Replayed ESPN finals:',result['games_played'],'teams:',365,'days:',len(days))

if __name__=='__main__': main()

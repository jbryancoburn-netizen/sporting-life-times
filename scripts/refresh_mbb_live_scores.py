#!/usr/bin/env python3
"""Fast, verified-source MBB score snapshot independent of the long news collector.

Reads the same authenticated-by-event ESPN data as the newsroom but does not
wait for RSS, player box scores or full school-calendar reconciliation.
This file updates *display* scores only. RETRO finals remain certified separately.
"""
import datetime as dt
import json
import sys
from pathlib import Path
from zoneinfo import ZoneInfo
from refresh_mbb_newspaper import fetch_men_scoreboards, parse_scores

ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/'data/mbb-live.json'
EASTERN=ZoneInfo('America/New_York')
PHASE={'pre':0,'in':1,'post':2}

def eastern_day(stamp):
    try:
        return dt.datetime.fromisoformat(str(stamp).replace('Z','+00:00')).astimezone(EASTERN).date().isoformat()
    except (TypeError,ValueError):
        return ''

def identity(game):
    return (str(game.get('id','')), eastern_day(game.get('date')),
            tuple(str(t.get('id')) for t in game.get('teams') or []))

def safe_score(team):
    try:
        return int(team.get('score'))
    except (ValueError,TypeError):
        return None

def reconcile(prior, fresh):
    """Do not regress a verified game to an older in-game provider snapshot."""
    if identity(prior)!=identity(fresh) or len(fresh.get('teams') or [])!=2:
        return prior
    old_phase=PHASE.get(prior.get('state'),0)
    new_phase=PHASE.get(fresh.get('state'),0)
    if new_phase<old_phase:
        return prior
    if old_phase==2 and prior.get('score_source')=='NCAA-origin verified final':
        return prior
    if old_phase==1 and new_phase==1:
        before=[safe_score(t) for t in prior['teams']]
        after=[safe_score(t) for t in fresh['teams']]
        if any(a is None or (b is not None and a<b) for a,b in zip(after,before)):
            return prior
    if new_phase>0 and any(safe_score(t) is None for t in fresh['teams']):
        return prior
    if not fresh.get('broadcast') and prior.get('broadcast'):
        fresh['broadcast']=prior['broadcast']
    return fresh

def update(old, fresh, now, day):
    """Preserve today's complete slate and previously archived games by event ID."""
    previous={str(g.get('id')):g for g in old.get('games') or []
              if isinstance(g,dict) and g.get('id')}
    current=[g for g in fresh if eastern_day(g.get('date'))==day and len(g.get('teams') or [])==2]
    previous_day=[g for g in previous.values() if eastern_day(g.get('date'))==day]
    if len(current)<max(5,int(len(previous_day)*0.8)):
        raise ValueError('Incomplete national scoreboard; refusing to replace '+str(len(previous_day))+' games with '+str(len(current)))
    changed_ids=[]
    for game in current:
        ident=str(game['id'])
        candidate=reconcile(previous[ident],game) if ident in previous else game
        if previous.get(ident)!=candidate:
            changed_ids.append(ident)
        previous[ident]=candidate
    result=dict(old)
    result['games']=list(previous.values())
    result['scores_updated_at']=now
    result['scoreboard_checked_at']=now
    return result,changed_ids

def main():
    day=dt.datetime.now(EASTERN).strftime('%Y%m%d')
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    old=json.loads(PATH.read_text(encoding='utf-8'))
    feed,sources=fetch_men_scoreboards(day)
    result,changes=update(old,parse_scores(feed),now,day[:4]+'-'+day[4:6]+'-'+day[6:])
    result['sources']=[s for s in (result.get('sources') or [])
                       if s.get('source') not in ('ESPN scores','ESPN unrestricted scores')]+sources
    PATH.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'day':day,'source_counts':[(s['source'],s.get('events'),s['ok']) for s in sources],
                      'games':len(result['games']),'changed':len(changes),
                      'changed_ids':changes[:25],'checked_at':now}))
if __name__=='__main__':
    main()

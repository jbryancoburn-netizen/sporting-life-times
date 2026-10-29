#!/usr/bin/env python3
"""NCAA Division I men's 2026 schedule archive: honest about source coverage.

Fetch day-by-day NCAA D-I men's scoreboard feeds. Never infer unreported times,
invent matches, or replace the separately maintained results/Elo ledger.
Only this division's new schedule artifact is written.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/college-soccer-men-d1-schedules-2026.json'
API='https://ncaa-api.henrygd.me/scoreboard/soccer-men/d1'
ET=ZoneInfo('America/New_York')
def fetch(day):
    url=f'{API}/{day:%Y/%m/%d}/all-conf'
    for n in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'SportingLifeTimes-D1Men-ScheduleAudit/1.0','Accept':'application/json'})
            with urllib.request.urlopen(req,timeout=12) as response:
                body=json.load(response)
            if not isinstance(body.get('games'),list):
                raise ValueError('response lacks games array')
            return day.isoformat(),body['games'],None
        except urllib.error.HTTPError as exc:
            if exc.code==404:
                return day.isoformat(),[],{'date':day.isoformat(),'error':'NCAA scoreboard returned HTTP 404','url':url}
            if n==2:
                return day.isoformat(),[],{'date':day.isoformat(),'error':str(exc)[:300],'url':url}
            time.sleep(n+1)
        except Exception as exc:
            if n==2:
                return day.isoformat(),[],{'date':day.isoformat(),'error':str(exc)[:300],'url':url}
            time.sleep(n+1)
def names(side):
    a=side.get('names') or {}
    return a.get('seo') or '',a.get('short') or a.get('full') or a.get('seo') or ''
def kickoff(game):
    date=game.get('startDate')
    clock=game.get('startTime')
    zone=str(game.get('startTimeZone') or game.get('timeZone') or '').strip().upper()
    if not date or not clock:return None
    clock=str(clock).strip()
    for suffix in (' ET',' EST',' EDT'):
        if clock.upper().endswith(suffix):
            zone=suffix.strip()
            clock=clock[:-len(suffix)].strip()
            break
    if zone not in ('ET','EST','EDT','AMERICA/NEW_YORK'):return None
    try:
        naive=dt.datetime.strptime(str(date)+' '+clock,'%m/%d/%Y %I:%M %p')
        return naive.replace(tzinfo=ET).astimezone(dt.timezone.utc).isoformat()
    except ValueError:return None
def build(days,known):
    allgames={};failures=[];foreign=[];invalid=[]
    for date,arr,error in days:
        if error:failures.append(error);continue
        for item in arr:
            g=item.get('game') or {}
            gid=str(g.get('gameID') or '')
            h,hname=names(g.get('home') or {})
            a,aname=names(g.get('away') or {})
            if not gid.isdecimal() or not h or not a or h==a:
                invalid.append({'date':date,'game_id':gid,'home':hname,'away':aname})
                continue
            if h not in known and a not in known:
                foreign.append(gid);continue
            rawstate=str(g.get('gameState') or '').lower()
            state='final' if rawstate in ('final','f') else 'live' if rawstate in ('live','in','inprogress','in-progress') else 'scheduled'
            event_date=g.get('startDate') or ''
            try:
                local=dt.datetime.strptime(event_date,'%m/%d/%Y').date().isoformat()
            except ValueError:
                local=date
            row={'match_id':'men-'+gid,'date':local,'home_team':h,'away_team':a,'home_name':hname,'away_name':aname,'kickoff_utc':kickoff(g),'status':state,'source_url':'https://www.ncaa.com/game/'+gid,'source_type':'ncaa_di_men_2026_scoreboard'}
            if state=='final':
                home_score=(g.get('home') or {}).get('score')
                away_score=(g.get('away') or {}).get('score')
                try:
                    row['home_goals']=int(str(home_score).strip());row['away_goals']=int(str(away_score).strip())
                except (TypeError,ValueError):
                    row['status']='final_score_unverified'
            prev=allgames.get(gid)
            if prev and (prev['home_team'],prev['away_team'])!=(h,a):
                invalid.append({'date':date,'game_id':gid,'reason':'conflicting team identity across dates'})
                continue
            allgames[gid]=row
    teams={f'men-d1:{k}':{'games':[]} for k in sorted(known)}
    for row in allgames.values():
        for home in (True,False):
            own=row['home_team' if home else 'away_team']
            if own not in known:continue
            other=row['away_team' if home else 'home_team']
            game={'match_id':row['match_id'],'date':row['date'],'opponent':other,'opponent_name':row['away_name' if home else 'home_name'],'venue':'home' if home else 'away','status':row['status'],'source_url':row['source_url'],'source_type':row['source_type'],'kickoff_utc':row['kickoff_utc']}
            if 'home_goals' in row:
                game['goals_for']=row['home_goals' if home else 'away_goals']
                game['goals_against']=row['away_goals' if home else 'home_goals']
            teams['men-d1:'+own]['games'].append(game)
    for entry in teams.values():
        entry['games'].sort(key=lambda x:(x['date'],x['match_id']))
    return {'schema_version':1,'season':2026,'cohort':'men-d1','coverage':'complete_date_scan' if not failures and not invalid else 'incomplete_source_scan','notice':'All available NCAA date scoreboard fixtures for requested dates; game availability, identity and kickoffs depend on source. Missing games cannot be inferred. No games fabricated.','requested_dates':len(days),'successful_dates':len(days)-len(failures),'failed_dates':failures,'invalid_source_records':invalid,'unmapped_other_games':len(foreign),'unique_games':len(allgames),'teams':teams}
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--start',default='2026-08-01')
    p.add_argument('--end',default='2026-12-15')
    p.add_argument('--max-workers',type=int,default=6)
    args=p.parse_args()
    start=dt.date.fromisoformat(args.start);end=dt.date.fromisoformat(args.end)
    assert start.year==2026 and end.year==2026 and end>=start and (end-start).days<=160
    elo=json.loads((ROOT/'data/college-soccer-elo.json').read_text())
    known={row['team_id'] for row in elo['cohorts']['men-d1']}
    days=[start+dt.timedelta(days=n) for n in range((end-start).days+1)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.max_workers,6))) as pool:
        result=list(pool.map(fetch,days))
    payload=build(result,known)
    payload['scan_start']=start.isoformat();payload['scan_end']=end.isoformat()
    if OUT.exists():
        previous=json.loads(OUT.read_text())
        if previous.get('coverage')=='complete_date_scan' and payload['coverage']!='complete_date_scan':
            raise RuntimeError('Do not replace an already complete source scan with a failed scan')
    OUT.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n')
    print('D-I men schedule scan:',payload['unique_games'],'games;',len(known),'programs;',len(payload['failed_dates']),'failed dates;',len(payload['invalid_source_records']),'invalid rows; coverage:',payload['coverage'])
if __name__=='__main__':main()

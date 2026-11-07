#!/usr/bin/env python3
"""Completed D-I versus outside-D-I scoreboard games; never used for RETRO Elo."""
import json
import urllib.request
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'data/mbb-non-di-verified-finals-2026-27.json'
teams=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
DI={str(t['espn_id']):str(t['id']) for t in teams if t.get('espn_id')}
ET=ZoneInfo('America/New_York')
BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'

def convert(e):
    if (e.get('status') or {}).get('type',{}).get('completed') is not True:return None
    season=e.get('season') or {}
    if season.get('year') not in (2027,None) or season.get('type') not in (2,3,None):return None
    comp=(e.get('competitions') or [{}])[0]
    sides=comp.get('competitors') or []
    home=next((s for s in sides if s.get('homeAway')=='home'),None)
    away=next((s for s in sides if s.get('homeAway')=='away'),None)
    if len(sides)!=2 or not home or not away:return None
    h=str((home.get('team') or {}).get('id') or '')
    a=str((away.get('team') or {}).get('id') or '')
    if not (h.isdigit() and a.isdigit() and h!=a) or (h in DI)==(a in DI):return None
    eid=str(e.get('id') or '')
    if not eid.isdigit():return None
    try:
        hs,aws=int(home['score']),int(away['score'])
        day=datetime.fromisoformat(e['date'].replace('Z','+00:00')).astimezone(ET).date().isoformat()
    except (KeyError,ValueError,TypeError,AttributeError):return None
    if day<'2026-11-01' or day>'2027-04-30' or min(hs,aws)<0 or max(hs,aws)>300 or hs==aws:return None
    if any(x in str(e.get('name') or '').lower() for x in ('exhibition','scrimmage')):return None
    did=h if h in DI else a
    other=away if did==h else home
    name=str((other.get('team') or {}).get('displayName') or '').strip()
    if not name:return None
    return {'id':eid,'date':day,'event_date':e['date'],
      'division_i_espn_id':did,'division_i_ncaa_id':DI[did],
      'opponent_espn_id':a if did==h else h,'opponent_name':name,
      'home_espn_id':h,'away_espn_id':a,'home_score':hs,'away_score':aws,
      'team_score':hs if did==h else aws,'opponent_score':aws if did==h else hs,
      'neutral':comp.get('neutralSite') is True,
      'site_verified':isinstance(comp.get('neutralSite'),bool),
      'verified':True,'classification':'regular-season','counts_for_retro':False,
      'source_tier':'independent_secondary',
      'source_url':'https://www.espn.com/mens-college-basketball/game/_/gameId/'+eid}

def collect(day):
    union,errors,success={},[],0
    for query in ('?limit=1000&dates=','?groups=50&limit=1000&dates='):
        try:
            request=urllib.request.Request(BASE+query+day.strftime('%Y%m%d'),
                headers={'User-Agent':'SportingLifeTimes/1.0','Accept':'application/json'})
            with urllib.request.urlopen(request,timeout=18) as response:payload=json.load(response)
            if not isinstance(payload.get('events'),list):raise ValueError('Missing scoreboard events')
            success+=1
            for e in payload['events']:
                r=convert(e)
                if r is None:continue
                previous=union.get(r['id'])
                if previous and any(previous[k]!=r[k] for k in ('date','division_i_espn_id',
                      'opponent_espn_id','team_score','opponent_score')):
                    union[r['id']]=None
                    errors.append('Contradictory final from scoreboard views: '+r['id'])
                elif r['id'] not in union:union[r['id']]=r
        except (OSError,ValueError,TypeError,KeyError) as exc:
            errors.append(str(day)+': '+str(exc)[:160])
    return {k:v for k,v in union.items() if v is not None},errors,success

def main():
    previous=json.loads(DEST.read_text()) if DEST.exists() else {}
    saved={str(x['id']):x for x in previous.get('games',[])
           if x.get('verified') is True and x.get('counts_for_retro') is False}
    now=datetime.now(timezone.utc).astimezone(ET).date()
    first=date(2026,11,1) if not saved else max(date(2026,11,1),now-timedelta(days=7))
    last=min(now,date(2027,4,30))
    checked,new,errors=0,0,[]
    if first<=last:
        for i in range((last-first).days+1):
            day=first+timedelta(days=i)
            rows,issues,success=collect(day)
            checked+=int(success>0);errors+=issues
            for k,row in rows.items():
                old=saved.get(k)
                if old and any(old.get(f)!=row.get(f) for f in
                    ('date','division_i_espn_id','opponent_espn_id','team_score','opponent_score')):
                    errors.append('Changed published final: '+k)
                    continue
                if old is None:new+=1
                saved[k]=row
    if first<=last and checked==0 and not saved:raise RuntimeError('No available game source')
    games=sorted(saved.values(),key=lambda x:(x['date'],x['id']))
    output={'season':'2026-27','counts_for_retro':False,
       'scope':'Finals with one school in D-I 365-program registry; outside opponent division not inferred',
       'games':games,
       'audit':{'games':len(games),'schools':len({g['division_i_ncaa_id'] for g in games}),
                'new':new,'days_checked':checked,'warnings':errors}}
    if not previous or previous.get('games')!=games:
        DEST.write_text(json.dumps(output,indent=2)+'\n')
    print('Non-D-I opponent finals:',len(games),'new:',new,'days checked:',checked,'warnings:',len(errors))
    for w in errors[:10]:print('WARN',w)

if __name__=='__main__':main()

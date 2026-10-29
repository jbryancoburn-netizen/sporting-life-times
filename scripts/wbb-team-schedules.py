#!/usr/bin/env python3
"""Import 2026-27 women's D-I per-team schedules; publish coverage and gaps.
Uses women-specific ESPN team schedule, no men's fixture data or fabricated fields.
"""
import concurrent.futures, json, pathlib, time, threading, urllib.request
DATA=pathlib.Path('data')
BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball'
clock=[0.0];mutex=threading.Lock()
def fetch(url):
    for attempt in range(4):
        with mutex:
            pause=max(0,clock[0]-time.monotonic())
            clock[0]=max(clock[0],time.monotonic())+.42
        if pause:time.sleep(pause)
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'SportingLifeTimesWBB/1.0'})
            with urllib.request.urlopen(req,timeout=25) as f:return json.load(f)
        except Exception:
            if attempt==3:raise
            time.sleep(2**attempt)
def game(row,teamid):
    comps=row.get('competitions') or [{}]
    c=comps[0];sides=c.get('competitors') or []
    home=next((s for s in sides if s.get('homeAway')=='home'),None)
    away=next((s for s in sides if s.get('homeAway')=='away'),None)
    if not home or not away:return None
    hid=str(home.get('team',{}).get('id') or '')
    aid=str(away.get('team',{}).get('id') or '')
    if teamid not in (hid,aid):return None
    rival=away if teamid==hid else home
    opp=str(rival.get('team',{}).get('id') or '')
    when=str(row.get('date') or c.get('date') or '')
    if len(when)<10 or not '2026-10-01'<=when[:10]<='2027-05-01':return None
    broadcasts=[]
    for b in c.get('broadcasts',[]) or []:
        n=b.get('names') or b.get('shortName') or ''
        broadcasts.extend(n if isinstance(n,list) else [n] if n else [])
    for b in c.get('geoBroadcasts',[]) or []:
        name=(b.get('media') or {}).get('shortName')
        if name:broadcasts.append(name)
    done=bool((row.get('status',{}).get('type') or {}).get('completed'))
    def score(s):
        try:return int(s.get('score')) if done else None
        except (ValueError,TypeError):return None
    return {'id':str(row.get('id') or ''),'date':when,'opponent_id':opp or None,
        'opponent':rival.get('team',{}).get('displayName') or 'Opponent TBA',
        'home_id':hid,'away_id':aid,
        'site':'neutral' if c.get('neutralSite') else 'home' if teamid==hid else 'away',
        'venue':(c.get('venue') or {}).get('fullName'),
        'broadcast':', '.join(dict.fromkeys(str(n) for n in broadcasts if n)) or None,
        'completed':done,'home_score':score(home),'away_score':score(away)}
def school(team):
    ident=str(team['team_id'])
    url=BASE+'/teams/'+ident+'/schedule?season=2027'
    try:
        data=fetch(url)
        dedupe={}
        for event in data.get('events') or []:
            g=game(event,ident)
            if g:dedupe[g['id'] or g['date']+'|'+str(g['opponent_id'])]=g
        rows=sorted(dedupe.values(),key=lambda g:(g['date'],g['id']))
        return ident,{'team':team['team'],'conference':team.get('conference',''),
              'source':'ESPN women-only team schedule','source_url':url,
              'game_count':len(rows),'status':'retrieved' if rows else 'no_games_returned','games':rows}
    except Exception as exc:
        return ident,{'team':team['team'],'source_url':url,'game_count':0,
              'status':'source_error','error':str(exc),'games':[]}
def main():
    roster=json.loads((DATA/'ncaaw-2026-27-teams.json').read_text())['teams']
    if len(roster)!=363 or len({t['team_id'] for t in roster})!=363:raise RuntimeError('363-team registry required')
    path=DATA/'ncaaw-schedules-2026-27.json'
    old=json.loads(path.read_text()).get('teams',{}) if path.exists() else {}
    result={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for ident,r in pool.map(school,roster):
            if r['status']=='source_error' and old.get(ident,{}).get('games'):
                r=old[ident].copy()
                r['status']='previously_retrieved; live source failed'
            result[ident]=r
    # Merge only game-ID-matched official school or conference TV announcements.
    # Both school copies of a matchup must receive identical evidence.
    evidence_path=DATA/'ncaaw-2026-27-official-broadcast-overrides.json'
    verified_games=0
    recovered_team_entries=0
    if evidence_path.exists():
        evidence=json.loads(evidence_path.read_text())
        if evidence.get('season')!='2026-27' or evidence.get('gender')!='women':
            raise RuntimeError('Wrong-season women TV evidence')
        source_index={}
        for row in evidence.get('rows',[]):
            gid=str(row.get('game_id') or '')
            if not gid or not row.get('broadcast') or not row.get('source_url'):
                raise RuntimeError('Incomplete women's TV evidence')
            if gid in source_index and source_index[gid]['broadcast']!=row['broadcast']:
                raise RuntimeError('Conflicting TV evidence for '+gid)
            source_index[gid]=row
        matches=set()
        for school_data in result.values():
            for g in school_data['games']:
                row=source_index.get(str(g['id']))
                if not row:continue
                if g.get('broadcast') and g['broadcast']!=row['broadcast']:
                    raise RuntimeError('ESPN vs official TV conflict for '+str(g['id'])+
                                       ': '+str(g['broadcast'])+' vs '+str(row['broadcast']))
                if not g.get('broadcast'):recovered_team_entries+=1
                g['broadcast']=row['broadcast']
                g['broadcast_source_url']=row['source_url']
                g['broadcast_source_type']=row['source_type']
                g['broadcast_verified']=True
                matches.add(str(g['id']))
        verified_games=len(matches)
        if len(matches)!=len(source_index):
            raise RuntimeError('Official TV evidence no longer matches game ledger: '+str(
                               sorted(set(source_index)-matches)[:12]))
    # University date/opponent/site audits are narrower than full venue/TV validation.
    from datetime import datetime
    from zoneinfo import ZoneInfo
    school_file=DATA/'ncaaw-2026-27-official-schedule-verifications.json'
    school_count=school_entries=0
    school_issues=[]
    if school_file.exists():
        source=json.loads(school_file.read_text())
        if source.get('season')!='2026-27' or source.get('gender')!='women':
            raise RuntimeError('Invalid women university schedule evidence')
        grouped={}
        for row in source.get('rows',[]):grouped.setdefault(str(row['team_id']),[]).append(row)
        for tid,checks in grouped.items():
            team_data=result.get(tid)
            if not team_data or team_data['game_count']!=len(checks):
                school_issues.append({'team_id':tid,'reason':'game-count discrepancy'})
                continue
            bygame={str(g['id']):g for g in team_data['games']}
            failed=[]
            for row in checks:
                g=bygame.get(str(row['game_id']))
                if not g:
                    failed.append(str(row['game_id'])+':not in school schedule')
                    continue
                try:
                    day=datetime.fromisoformat(g['date'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).strftime('%m-%d')
                except ValueError:day='invalid'
                if day!=row['verified_date'] or g.get('opponent')!=row['verified_opponent'] or (
                        row.get('verified_site') and g['site']!=row['verified_site']):
                    failed.append(str(row['game_id'])+':date/opponent/site mismatch')
            if failed:
                school_issues.append({'team_id':tid,'issues':failed[:12]})
                continue
            for row in checks:
                g=bygame[str(row['game_id'])]
                g['official_school_schedule_verified_fields']=row['verified_fields']
                g['official_school_schedule_source_url']=row['source_url']
            team_data['official_school_schedule_checked']=True
            team_data['official_school_schedule_source_url']=checks[0]['source_url']
            school_count+=1
            school_entries+=len(checks)
    counts=[r['game_count'] for r in result.values()]
    audit={'season':'2026-27','programs':len(result),
      'teams_with_20plus_games':sum(n>=20 for n in counts),
      'teams_with_1plus_games':sum(n>0 for n in counts),
      'total_team_game_entries':sum(counts),
      'zero_game_teams':sum(n==0 for n in counts),
      'missing_specific_venue':sum(g['venue'] is None for r in result.values() for g in r['games']),
      'missing_broadcast':sum(g['broadcast'] is None for r in result.values() for g in r['games']),
      'official_verified_broadcast_unique_games':verified_games,
      'official_verified_broadcast_team_entries':sum(g.get('broadcast_verified') is True for r in result.values() for g in r['games']),
      'recovered_broadcast_team_entries_this_pass':recovered_team_entries,
      'official_venue_verified_game_entries':sum(g.get('venue_verified') is True for r in result.values() for g in r['games']),
      'venue_note':'Venue values come from ESPN. Non-null does NOT establish official school verification.',
      'broadcast_evidence_file':'data/ncaaw-2026-27-official-broadcast-overrides.json',
      'official_school_schedules_verified_date_opponent':school_count,
      'official_school_schedule_entries_verified_date_opponent':school_entries,
      'official_school_schedule_checks_pending':school_issues,
      'official_school_schedule_evidence_file':'data/ncaaw-2026-27-official-schedule-verifications.json',
      'under_20_games':[{'team_id':i,'team':r['team'],'games':r['game_count'],
          'status':r['status'],'error':r.get('error')} for i,r in result.items() if r['game_count']<20],
      'policy':'School-specific women ESPN calendars are NOT yet university-verified. Missing fields never fabricated.'}
    output={'season':'2026-27','gender':'women','source':'ESPN women-only team schedules',
      'note':'Calendar entries are source-specific; official university verification remains outstanding.',
      'teams':result}
    for f,data in [(path,output),(DATA/'ncaaw-schedules-2026-27-audit.json',audit)]:
        text=json.dumps(data,indent=2,ensure_ascii=False)+'\n'
        if not f.exists() or f.read_text()!=text:f.write_text(text)
    print('Women schedule audit:',audit['programs'],'schools,',audit['teams_with_20plus_games'],
      'with >=20 games;',audit['teams_with_1plus_games'],'with any games')
    if audit['teams_with_1plus_games']<250:raise RuntimeError('Too few women team schedules for publication')
if __name__=='__main__':main()

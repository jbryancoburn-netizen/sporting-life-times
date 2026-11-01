#!/usr/bin/env python3
"""Import 2026-27 women's D-I per-team schedules; publish coverage and gaps.
Uses women-specific ESPN team schedule, no men's fixture data or fabricated fields.
"""
import concurrent.futures, json, pathlib, time, threading, urllib.request, runpy
from datetime import datetime
from zoneinfo import ZoneInfo
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
def local_day(value):
    """Calendar comparisons use Eastern game dates, not the UTC date."""
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(
        ZoneInfo('America/New_York')).date()


def retain_official_evidence(previous, incoming):
    """Carry prior citations only for the SAME women's game and playing day.

    ESPN refreshes are not fresh official verification. Do not move verified
    source claims to a different opponent, site, or playing date.
    """
    old_games={str(g.get('id')):g for g in previous.get('games', [])}
    kept=0
    for game in incoming.get('games', []):
        old=old_games.get(str(game.get('id')))
        if not old or any(str(game.get(k)) != str(old.get(k))
                          for k in ('opponent_id','home_id','away_id')):
            continue
        try:
            if local_day(game['date']) != local_day(old['date']):
                continue
        except (KeyError,TypeError,ValueError):
            continue
        official_keys=[k for k in old if k.startswith('official_')]
        if not official_keys:
            continue
        for key in official_keys:
            # These claims require independent corroboration when the event
            # moves location or the ESPN home/neutral label changes.
            if game.get('site') != old.get('site') and (
                'site' in key or 'home_away' in key):
                continue
            if game.get('venue') != old.get('venue') and 'venue' in key:
                continue
            value=old[key]
            if key.endswith('verified_fields') and isinstance(value,list):
                value=[v for v in value if
                       (v!='home_away' or game.get('site')==old.get('site')) and
                       (v!='venue' or game.get('venue')==old.get('venue'))]
            game[key]=value
        if game.get('venue')==old.get('venue') and old.get('venue_verified') is True:
            game['venue_verified']=True
        kept+=1
    return kept


def validate_reciprocal_games(calendars):
    """Reject importer regressions before replacing the published master."""
    from collections import defaultdict
    by_game=defaultdict(list)
    for tid,entry in calendars.items():
        seen=set()
        for game in entry.get('games', []):
            gid=str(game.get('id') or '')
            if not gid or gid in seen or tid not in (
                    str(game.get('home_id')),str(game.get('away_id'))):
                raise RuntimeError(f"Invalid/duplicate women's game {gid} for {tid}")
            seen.add(gid)
            by_game[gid].append((tid,game))
    for gid,records in by_game.items():
        if len(records)>2:
            raise RuntimeError('Duplicate global women game ID '+gid)
        if len(records)==2:
            (t1,a),(t2,b)=records
            if str(a.get('opponent_id'))!=t2 or str(b.get('opponent_id'))!=t1:
                raise RuntimeError('Reciprocal opponent mismatch '+gid)
            if any(a.get(k)!=b.get(k) for k in ('date','home_id','away_id','venue')):
                raise RuntimeError('Reciprocal date/site/venue mismatch '+gid)


def main():
    roster=json.loads((DATA/'ncaaw-2026-27-teams.json').read_text())['teams']
    if len(roster)!=363 or len({t['team_id'] for t in roster})!=363:raise RuntimeError('363-team registry required')
    path=DATA/'ncaaw-schedules-2026-27.json'
    old=json.loads(path.read_text()).get('teams',{}) if path.exists() else {}
    result={}
    retained_evidence=0
    coverage_fallbacks=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for ident,r in pool.map(school,roster):
            previous=old.get(ident,{})
            previous_games=previous.get('games',[])
            # A shortened/empty ESPN response is not a verified cancellation.
            # Keep the last full calendar rather than erase university evidence.
            if previous_games and (r['status']!='retrieved' or
                    (len(previous_games)>=20 and
                     len(r['games'])<max(20,int(len(previous_games)*0.8)))):
                coverage_fallbacks.append(ident)
                r=previous.copy()
                r['status']='previously_retrieved; live calendar unavailable/incomplete'
            else:
                retained_evidence+=retain_official_evidence(previous,r)
            result[ident]=r
    # The organizer's authoritative two-game schedule must survive the weekly
    # ESPN reimport. This is the same correction as the manual finalizer.
    apply_maui=runpy.run_path(
        str(pathlib.Path(__file__).with_name('apply_ncaaw_maui_tipoff_corrections.py'))
    )['apply']
    verified_tipoff_corrections=apply_maui({
        'season':'2026-27','gender':'women','teams':result})
    validate_reciprocal_games(result)
    # Merge only game-ID-matched official school or conference TV announcements.
    # Both school copies of a matchup must receive identical evidence.
    evidence_path=DATA/'ncaaw-2026-27-official-broadcast-overrides.json'
    verified_games=0
    recovered_team_entries=0
    broadcast_disagreements=[]
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
                    broadcast_disagreements.append({
                        'game_id':str(g['id']),
                        'espn_broadcast':g['broadcast'],
                        'official_broadcast':row['broadcast'],
                        'official_source_url':row['source_url']})
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
      'retained_prior_official_evidence_game_rows':retained_evidence,
      'partial_calendar_fallback_school_ids':coverage_fallbacks,
      'organizer_confirmed_tipoff_changes_this_refresh':verified_tipoff_corrections,
      'official_vs_espn_broadcast_disagreements':broadcast_disagreements,
      'policy':'Women-specific ESPN imports do not erase matching official university evidence; official tournament tipoffs and cited TV evidence take precedence. No invented fields.'}
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

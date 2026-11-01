"""Independent MBB news/score feed. Failures retain last-success timestamps and data."""
import concurrent.futures as cf
import datetime as dt
import email.utils
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from zoneinfo import ZoneInfo
from mbb_player_boxscores import parse_boxscore, aggregate
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/mbb-live.json'
# Official NCAA men/women feed directories and CBS for attributed headlines.
# The old ESPN RSS endpoint currently returns invalid XML and is not polled;
# ESPN live scores/boxscore remain an attributed secondary source.
# FOX RSS is deliberately excluded: its feed license limits free use to
# individuals and non-profit organizations for non-commercial purposes.
FEEDS=[
    ('CBS Sports','https://www.cbssports.com/rss/headlines/college-basketball/','MBB'),
    ('NCAA Men','https://www.ncaa.com/news/basketball-men/d1/rss.xml','MBB'),
    ('NCAA Women','https://www.ncaa.com/news/basketball-women/d1/rss.xml','WBB'),
]
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'SportingLifeTimes/1.0 (+sports newspaper; attributed links)'})
    with urllib.request.urlopen(req,timeout=18) as r:return r.read()
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',s or ''))).strip()
def date(s):
    try:return email.utils.parsedate_to_datetime(s).astimezone(dt.timezone.utc).isoformat()
    except (ValueError,TypeError,AttributeError):return None

def parse_rss(payload,source,category='MBB'):
    root=ET.fromstring(payload);items=[]
    for item in root.findall('.//item'):
        title=clean(item.findtext('title'));link=item.findtext('link','').strip();stamp=date(item.findtext('pubDate',''))
        if not title or not link.startswith('https://') or not stamp:continue
        media=item.find('{http://search.yahoo.com/mrss/}content')
        items.append({'title':title,'url':link,'source':source,'published_at':stamp,'summary':clean(item.findtext('description'))[:350],'category':category,'image_url':media.get('url') if media is not None else None})
    return items

def parse_scores(data):
    out=[]
    for event in data.get('events',[]):
        comp=(event.get('competitions') or [{}])[0];status=event.get('status',{}).get('type',{})
        competitors=sorted(comp.get('competitors',[]),key=lambda x:x.get('homeAway')=='home')
        out.append({'id':event['id'],'date':event.get('date'),'state':status.get('state'),'status':status.get('shortDetail'),'teams':[{'id':t.get('team',{}).get('id'),'name':t.get('team',{}).get('displayName'),'logo':t.get('team',{}).get('logo'),'score':t.get('score')} for t in competitors]})
    return out

def reconcile_ncaa_final_scores(espn_games, official_rows):
    """Prefer independently identified NCAA-origin finals to stale ESPN snapshots.

    The official final may post before an ESPN response is complete. Only
    reconcile an exact ESPN event ID and the same two verified school IDs.
    Never infer a matchup, change a scheduled game, or fabricate a score.
    """
    by_event = {str(x.get('espn_id')): x for x in official_rows
                if x.get('phase') == 'final' and x.get('espn_id')}
    discrepancies = []
    for game in espn_games:
        official = by_event.get(str(game.get('id')))
        if not official:
            continue
        away, home = str(official.get('away_id')), str(official.get('home_id'))
        teams = {str(t.get('id')): t for t in game.get('teams', [])}
        if set(teams) != {away, home} or away == home:
            continue
        a, h = official.get('away_score'), official.get('home_score')
        if not all(isinstance(v, int) and v >= 0 for v in (a, h)) or a == h:
            continue
        was = (teams[away].get('score'), teams[home].get('score'))
        if was != (str(a), str(h)):
            discrepancies.append({'game_id': str(game['id']), 'espn_away': was[0],
                                  'espn_home': was[1], 'ncaa_away': a, 'ncaa_home': h})
        teams[away]['score'], teams[home]['score'] = str(a), str(h)
        game['state'], game['status'] = 'post', 'Final'
        game['score_source'] = 'NCAA-origin verified final'
    return discrepancies


def fetch_ncaa_scoreboard(sport, day, fetcher=fetch):
    """NCAA-origin data via attributed bridge; legacy direct endpoint as fallback.

    The retired Casablanca endpoint cannot be assumed to work. The bridge is
    an independent delivery path, NOT an independent publisher of NCAA data.
    Only accept well-formed game collections; a transport success alone does
    not establish a verified event or third-party score corroboration.
    """
    assert sport in ('basketball-men','basketball-women')
    dated=dt.date.fromisoformat(day)
    bridge=('https://ncaa-api.henrygd.me/scoreboard/'+sport+'/d1/'
            +dated.strftime('%Y/%m/%d')+'/all-conf')
    direct=('https://data.ncaa.com/casablanca/scoreboard/'+sport+'/d1/'
            +dated.strftime('%Y/%m/%d')+'/scoreboard.json')
    attempted=[]
    for name,url in (('NCAA.com via third-party relay',bridge),
                     ('NCAA.com direct (legacy)',direct)):
        try:
            payload=json.loads(fetcher(url))
            if not isinstance(payload,dict) or not isinstance(payload.get('games'),list):
                raise ValueError('Scoreboard schema did not contain games array')
            # Successful empty slate is different from failed retrieval.
            return payload,{'provider':name,'source_url':url,'checked_day':day,
                            'ok':True,'attempted':attempted,'source_origin':'NCAA.com',
                            'independent_second_publisher':False}
        except Exception as exc:
            attempted.append({'provider':name,'url':url,'error':type(exc).__name__})
    raise ValueError('NCAA-origin scoreboard unavailable: '+
                     ','.join(x['provider']+'='+x['error'] for x in attempted))


def parse_ncaa_player_boxscore(payload, contest, expected_ncaa_ids=None):
    """Safely normalize NCAA-origin player totals; never infer team membership.

    Team side is established only from the game's verified NCAA team IDs or
    an explicit isHome marker in its game boxscore. Per-team player points
    must reconcile exactly to the independently reported NCAA final score.
    An incomplete or partially typed response yields no publishable stats.
    """
    if not isinstance(payload, dict) or contest.get('phase') != 'final':
        return None
    data = payload.get('data') if isinstance(payload.get('data'), dict) else payload
    box = data.get('boxscore', data) if isinstance(data, dict) else {}
    if not isinstance(box, dict) or not isinstance(box.get('teamBoxscore'), list):
        return None
    boxes = box['teamBoxscore']
    if len(boxes) != 2:
        return None
    sides = {}
    for t in box.get('teams') or []:
        if not isinstance(t, dict) or not isinstance(t.get('isHome'), bool):
            continue
        tid = str(t.get('teamId') or '')
        if tid.isdigit() and tid not in sides:
            sides[tid] = 'home' if t['isHome'] else 'away'
    expected_ncaa_ids = expected_ncaa_ids or {}
    for side,tid in expected_ncaa_ids.items():
        if side in ('home','away') and str(tid).isdigit():
            if tid in sides and sides[tid] != side:
                return None
            sides[str(tid)] = side
    def stat_int(value):
        if isinstance(value, bool) or value is None:
            return None
        text = str(value).strip()
        if not text.isdigit():
            return None
        n = int(text)
        return n if n <= 250 else None
    outcomes = {}
    for block in boxes:
        if not isinstance(block, dict):
            return None
        tid = str(block.get('teamId') or '')
        side = sides.get(tid)
        if side not in ('home','away') or side in outcomes:
            return None
        expected = stat_int(contest.get(side+'_score'))
        players = block.get('playerStats')
        if expected is None or expected > 200 or not isinstance(players,list):
            return None
        total = 0; normalized = []; seen = set()
        for p in players:
            if not isinstance(p, dict):
                return None
            name = str(p.get('fullName') or '').strip()
            if not name:
                name = ' '.join(str(p.get(k) or '').strip() for k in ('firstName','lastName')).strip()
            # Only stat-complete rows are displayed; DNP records without
            # points may be omitted but cannot contribute invented values.
            pts = stat_int(p.get('points'))
            if pts is None:
                continue
            if not name or len(name) > 90:
                return None
            pid = str(p.get('id') or name)
            if pid in seen:
                return None
            seen.add(pid)
            fields = {}
            for key,origin in (('reb','totalRebounds'),('ast','assists'),
                               ('stl','steals'),('blk','blockedShots'),
                               ('fgm','fieldGoalsMade'),('fga','fieldGoalsAttempted'),
                               ('ftm','freeThrowsMade'),('fta','freeThrowsAttempted'),
                               ('tpm','threePointsMade'),('tpa','threePointsAttempted'),
                               ('tov','turnovers')):
                fields[key] = stat_int(p.get(origin))
            for made,attempted in (('fgm','fga'),('ftm','fta'),('tpm','tpa')):
                if fields[made] is not None and fields[attempted] is not None and fields[made] > fields[attempted]:
                    return None
            total += pts
            normalized.append({'id':pid,'name':name,'pts':pts,**fields})
        if not normalized or total != expected:
            return None
        outcomes[side] = {'ncaa_team_id':tid,'score':expected,'players':normalized}
    if set(outcomes) != {'away','home'}:
        return None
    return {'ncaa_id':str(contest['ncaa_id']),'espn_id':contest.get('espn_id'),
            'day':contest.get('day'),'gender':contest.get('gender','men'),
            'source':'NCAA-origin player box score via third-party relay',
            'source_url':'https://ncaa-api.henrygd.me/game/'+str(contest['ncaa_id'])+'/boxscore',
            'away':outcomes['away'],'home':outcomes['home']}


def parse_ncaa_crosscheck(payload, espn_events, crosswalk, day):
    """Admit only uniquely identified NCAA D-I fixtures. No inferred times or scores.

    The official NCAA entry supplies authoritative status/scores. ESPN is used
    solely to attach an existing event ID and tipoff time when the verified
    teams match. Unmatched schools remain audit counts, not fabricated games.
    """
    from update_ncaam_season import school_key, numeric_score
    if not isinstance(payload, dict) or not isinstance(payload.get('games'), list):
        raise ValueError('NCAA scoreboard lacks a games list')
    index = {}
    for school in crosswalk.get('teams', []):
        if not school.get('espn_id') or not school.get('id'):
            continue
        for label in (school.get('name'), school.get('espn_name')):
            if label:
                index.setdefault(school_key(label), set()).add(str(school['espn_id']))
    schools = {str(t['espn_id']): t for t in crosswalk.get('teams', []) if t.get('espn_id')}
    events = {}
    for event in espn_events:
        comp = (event.get('competitions') or [{}])[0]
        sides = comp.get('competitors') or []
        a = next((x for x in sides if x.get('homeAway') == 'away'), {})
        h = next((x for x in sides if x.get('homeAway') == 'home'), {})
        aid, hid = str((a.get('team') or {}).get('id') or ''), str((h.get('team') or {}).get('id') or '')
        if aid and hid and aid != hid:
            events.setdefault((aid, hid), []).append(event)
    rows = []; seen = set(); unresolved = 0
    for wrapper in payload['games']:
        game = wrapper.get('game', wrapper)
        if not isinstance(game, dict):
            unresolved += 1
            continue
        gid = str(game.get('gameID') or game.get('gameId') or '')
        away, home = game.get('away') or {}, game.get('home') or {}
        def find_team(item):
            labels = item.get('names') or {}
            candidates = [item.get('name'), labels.get('short'), labels.get('full'),
                          labels.get('seo'), labels.get('char6')]
            ids = set()
            for label in candidates:
                if label:
                    ids.update(index.get(school_key(label), set()))
            return next(iter(ids)) if len(ids) == 1 else None
        aid, hid = find_team(away), find_team(home)
        if not gid.isdigit() or not aid or not hid or aid == hid or gid in seen:
            unresolved += 1
            continue
        seen.add(gid)
        matched = events.get((aid, hid), [])
        # A duplicate ESPN pairing is ambiguous and cannot be joined silently.
        event = matched[0] if len(matched) == 1 else None
        status = str(game.get('gameState') or game.get('gameStatus') or game.get('status') or '').lower()
        phase = 'final' if status.startswith('final') or status in ('post','completed','official') else (
            'live' if any(s in status for s in ('live','progress','half','period')) else 'upcoming')
        hs, aws = numeric_score(home.get('score')), numeric_score(away.get('score'))
        if phase == 'final' and (hs is None or aws is None or hs == aws):
            phase = 'unconfirmed'
        rows.append({'id':'ncaa:'+gid,'ncaa_id':gid,'espn_id':str(event['id']) if event else None,
                     'day':day,'date':event.get('date') if event else None,
                     'away_id':aid,'home_id':hid,
                     'away_name':schools[aid].get('name'),'home_name':schools[hid].get('name'),
                     'away_score':aws if phase in ('live','final') else None,
                     'home_score':hs if phase in ('live','final') else None,
                     'phase':phase,'source':'NCAA-origin scoreboard; transport identified separately'})
    return rows, unresolved


def official_school_fixtures(root, day):
    """Index only explicitly source-backed school fixtures; never infer tipoff."""
    found = {}
    directory = root/'data/mbb-schedules-2026-27'
    for path in directory.glob('*.json'):
        if not path.stem.isdigit():
            continue
        try:
            school = json.loads(path.read_text())
        except (ValueError, OSError):
            continue
        reporter = str(school.get('espn_team_id') or path.stem)
        for event in school.get('events') or []:
            if not str(event.get('date') or '').startswith(day):
                continue
            if event.get('official_source') is not True or event.get('site_verified') is not True:
                continue
            comp = (event.get('competitions') or [{}])[0]
            members = comp.get('competitors') or []
            ids = [str((m.get('team') or {}).get('id') or '') for m in members]
            if len(ids) != 2 or not all(x.isdigit() for x in ids) or ids[0] == ids[1]:
                continue
            if reporter not in ids:
                continue
            url = event.get('school_source_url') or school.get('source') or event.get('site_source_url')
            if not isinstance(url, str) or not url.startswith('https://'):
                continue
            key = tuple(sorted(ids, key=int))
            entry = found.setdefault(key, {'team_ids':list(key),'source_urls':set(),'reporting_schools':set()})
            entry['source_urls'].add(url)
            entry['reporting_schools'].add(reporter)
    return [{'team_ids':row['team_ids'],'source_urls':sorted(row['source_urls'])[:3],
             'school_confirmations':len(row['reporting_schools'])}
            for row in found.values()]


def conference_schedule_fixtures(root, day):
    """Dated, source-linked men's fixture evidence from published conferences.

    This indexes curated historical announcement rows, not a fresh live check.
    Only verified numeric ESPN identities and exact dates are usable. A
    neutral-site 'vs.' row does not assert an actual home-court advantage.
    Conference TV names are retained as attributed announcements, never used
    as independent final-score evidence.
    """
    filenames = (
        'mbb-official-conference-game-evidence.json',
        'mbb-additional-conference-game-evidence.json',
        'mbb-october-conference-evidence.json',
        'mbb-western-conference-game-evidence.json',
    )
    found = {}
    invalid = 0
    for filename in filenames:
        document = json.loads((root/'data'/filename).read_text())
        if document.get('season') != '2026-27':
            raise ValueError('Unexpected conference schedule season: '+filename)
        for row in document.get('rows', []):
            if row.get('date') != day:
                continue
            away, home = str(row.get('visitor_id') or ''), str(row.get('host_id') or '')
            url = row.get('source_url')
            if (not away.isdigit() or not home.isdigit() or away == home or
                    not isinstance(url, str) or not url.startswith('https://')):
                invalid += 1
                continue
            pair = tuple(sorted((away, home), key=int))
            entry = found.setdefault(pair, {'team_ids': list(pair), 'source_urls': set(),
                                              'network_announcements': set(),
                                              'sources': set(), 'neutral_announced': False})
            entry['source_urls'].add(url)
            entry['sources'].add(filename)
            if row.get('tv') and str(row['tv']).strip().upper() not in ('TBA','TBD'):
                entry['network_announcements'].add(str(row['tv']).strip())
            if str(row.get('relation') or '').lower().rstrip('.') == 'vs':
                entry['neutral_announced'] = True
    results = []
    for entry in found.values():
        networks = sorted(entry['network_announcements'])
        results.append({'team_ids': entry['team_ids'],
                        'source_urls': sorted(entry['source_urls'])[:4],
                        'network_announced': networks[0] if len({x.casefold() for x in networks}) == 1 else None,
                        'network_conflict': len({x.casefold() for x in networks}) > 1,
                        'neutral_announced': entry['neutral_announced'],
                        'evidence_files': len(entry['sources'])})
    return {'games': results, 'invalid_rows': invalid,
            'documents_consulted': len(filenames)}


def women_school_fixtures(root, day):
    """Use school-published women's game verifications, never an inferred score.

    The three independent school-verification batches contain school-specific
    date, opponent and venue checks. They are indexed by the existing ESPN
    game ID ONLY when the university source and team pair agree. This is
    evidence for a published FIXTURE, never a final or live score.
    """
    evidence = {}
    base = root/'data'
    source_files = (
        'ncaaw-2026-27-official-schedule-verifications.json',
        'ncaaw-2026-27-additional-official-evidence.json',
        'ncaaw-official-school-verification-batch-01.json',
        'ncaaw-official-school-verification-batch-02.json',
        'ncaaw-official-school-verification-batch-03.json',
    )
    for filename in source_files:
        doc = json.loads((base/filename).read_text())
        if doc.get('season') != '2026-27' or doc.get('gender') != 'women':
            raise ValueError('Unexpected women schedule ledger: '+filename)
        for row in doc.get('rows', []):
            gid = str(row.get('game_id') or '')
            recorded = str(row.get('date') or row.get('verified_date') or '')
            if not gid.isdigit() or recorded not in (day, day[5:]):
                continue
            url = row.get('source_url')
            if not isinstance(url, str) or not url.startswith('https://'):
                continue
            reporter = str(row.get('team_id') or '')
            other = str(row.get('opponent_id') or '')
            verified = set(row.get('verified_fields') or [])
            if filename.startswith('ncaaw-official-school-verification-batch-'):
                if not (reporter.isdigit() and other.isdigit() and reporter != other and
                        {'local_game_date','opponent_id'}.issubset(verified)):
                    continue
            pair = tuple(sorted((reporter,other), key=int)) if (
                reporter.isdigit() and other.isdigit() and reporter != other) else None
            entry = evidence.setdefault(gid, {'urls':set(),'schools':set(),
                                                'pairs':set()})
            entry['urls'].add(url)
            if reporter.isdigit():
                entry['schools'].add(reporter)
            if pair:
                entry['pairs'].add(pair)
    rows = []
    for gid,entry in evidence.items():
        # The same ESPN game ID with contradictory university opponent pairs
        # is unsafe to certify; discard it until the master ledger is audited.
        if len(entry['pairs']) > 1:
            continue
        item={'espn_id':gid,'source_urls':sorted(entry['urls'])[:4],
              'school_confirmations':len(entry['schools'])}
        if entry['pairs']:
            item['team_ids']=list(next(iter(entry['pairs'])))
        rows.append(item)
    return rows

def main():
    now=dt.datetime.now(dt.timezone.utc).isoformat();old=json.loads(OUT.read_text()) if OUT.exists() else {}
    out={**old,'attempted_at':now,'sources':[]}; articles=[]
    def collect(spec):
        name,url,category=spec
        try:
            rows=parse_rss(fetch(url),name,category)
            return rows,{'source':name,'url':url,'ok':bool(rows),'articles':len(rows)}
        except Exception as e:return [],{'source':name,'url':url,'ok':False,'error':type(e).__name__}
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for rows,status in pool.map(collect,FEEDS):articles.extend(rows);out['sources'].append(status)
    if articles:
        unique={a['url']:a for a in old.get('articles',[])}
        for a in articles:unique[a['url']]=a
        out['articles']=sorted(unique.values(),key=lambda a:a.get('published_at',''),reverse=True)[:150]
        out['news_updated_at']=now
    day=dt.datetime.now(ZoneInfo('America/New_York')).strftime('%Y%m%d')
    score_url='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&limit=1000&dates='+day
    try:
        result=json.loads(fetch(score_url));assert 'events' in result
        out['games']=parse_scores(result);out['scores_updated_at']=now
        out['sources'].append({'source':'ESPN scores','url':score_url,'ok':True})
    except Exception as e:out['sources'].append({'source':'ESPN scores','url':score_url,'ok':False,'error':type(e).__name__})
    # University athletics calendars are independent dated fixture evidence.
    # They never certify a live score, final, or an unprinted tipoff time.
    try:
        school_rows=official_school_fixtures(ROOT,dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat())
        women_school_rows=women_school_fixtures(ROOT,dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat())
        out['school_fixtures']={'day':dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat(),
            'checked_at':now,'games':school_rows,
            'source':'verified official university athletics schedules; date/opponent only'}
        out['women_school_fixtures']={'day':dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat(),
            'checked_at':now,'games':women_school_rows,
            'source':'verified individual women university schedule entries; date/opponent only'}
        out['sources'].append({'source':'Official school fixture evidence','ok':True,
              'men':len(school_rows),'women':len(women_school_rows),
              'men_school_confirmations':sum(int(g.get('school_confirmations') or 0) for g in school_rows),
              'women_school_confirmations':sum(int(g.get('school_confirmations') or 0) for g in women_school_rows)})
    except Exception as exc:
        out['sources'].append({'source':'Official school fixture evidence','ok':False,
                                'error':type(exc).__name__})
    # Conference office announcements are independent of ESPN's fixture list.
    # These archived rows do not certify a game's current score.
    try:
        cday=dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat()
        conference=conference_schedule_fixtures(ROOT,cday)
        out['conference_fixtures']={'day':cday,'indexed_at':now,
            'source':'curated conference athletics schedules; fixture and announced TV only',
            **conference}
        out['sources'].append({'source':'Conference-published fixture archives',
            'ok':True,'games':len(conference['games']),
            'documents_consulted':conference['documents_consulted'],
            'invalid_rows':conference['invalid_rows']})
    except Exception as exc:
        out['sources'].append({'source':'Conference-published fixture archives',
            'ok':False,'error':type(exc).__name__})
    # Official NCAA is the independent first-party ledger; ESPN supplements it.
    # The existing newspaper workflow commits this inside mbb-live.json.
    ncaa_day=dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat()
    ncaa_url='https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/'+ncaa_day.replace('-','/')+'/all-conf'
    try:
        ncaa_payload,ncaa_origin=fetch_ncaa_scoreboard('basketball-men',ncaa_day)
        crosswalk=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())
        official_rows,unresolved=parse_ncaa_crosscheck(ncaa_payload,result.get('events',[]) if 'result' in locals() else [],crosswalk,
            dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat())
        out['ncaa_crosscheck']={'day':dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat(),
            'checked_at':now,'source_url':ncaa_origin['source_url'],
            'provider':ncaa_origin['provider'],'games':official_rows,
            'total_source_games':len(ncaa_payload['games']),'unresolved_games':unresolved,
            'scope':'NCAA-origin scores via attributed delivery path; verified D-I identities only; ESPN IDs/tipoffs secondary'}
        out['score_discrepancies'] = reconcile_ncaa_final_scores(out.get('games', []), official_rows)
        if out['score_discrepancies']:
            print('Corrected scoreboard totals using NCAA-origin verified finals:', out['score_discrepancies'])
        out['sources'].append({'source':ncaa_origin['provider'],'url':ncaa_origin['source_url'],'ok':True,
                               'resolved':len(official_rows),'unresolved':unresolved})
    except Exception as e:
        # Preserve previously published evidence with its original timestamp.
        # The reader refuses stale crosschecks; an outage is never agreement.
        out['sources'].append({'source':'NCAA-origin men scoreboard','url':ncaa_url,
                               'ok':False,'error':type(e).__name__})
    # Women's D-I receives the same independent official-source reconciliation.
    # ESPN identifies only the secondary event/tipoff. Shared school identities
    # use the already reviewed men's crosswalk; unmatched schools are excluded.
    women_url='https://ncaa-api.henrygd.me/scoreboard/basketball-women/d1/'+ncaa_day.replace('-','/')+'/all-conf'
    try:
        women_registry=json.loads((ROOT/'data/ncaaw-2026-27-retro-primary.json').read_text())
        men_names={str(t['espn_id']):t['name'] for t in crosswalk['teams']} if 'crosswalk' in locals() else {}
        if not men_names:
            men_crosswalk=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())
            men_names={str(t['espn_id']):t['name'] for t in men_crosswalk['teams']}
        women_teams=[{'id':'women:'+str(t['team_id']),'espn_id':str(t['team_id']),
                      'name':men_names.get(str(t['team_id']),t['team']),
                      'espn_name':t['team']} for t in women_registry.get('rankings',[])
                     if t.get('team_id') and t.get('team')]
        women_crosswalk={'teams':women_teams}
        women_score_url='https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?groups=50&limit=1000&dates='+day
        try:
            women_provider=json.loads(fetch(women_score_url))
            women_events=women_provider.get('events',[])
            if not isinstance(women_events,list):women_events=[]
            out['sources'].append({'source':'ESPN women secondary game IDs','url':women_score_url,'ok':True})
        except Exception as exc:
            women_events=[]
            out['sources'].append({'source':'ESPN women secondary game IDs','url':women_score_url,
                                   'ok':False,'error':type(exc).__name__})
        women_ncaa,women_origin=fetch_ncaa_scoreboard('basketball-women',ncaa_day)
        women_rows,women_unresolved=parse_ncaa_crosscheck(women_ncaa,women_events,women_crosswalk,
            dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat())
        out['ncaa_women_crosscheck']={'day':dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat(),
            'checked_at':now,'source_url':women_origin['source_url'],
            'provider':women_origin['provider'],'games':women_rows,
            'total_source_games':len(women_ncaa['games']),'unresolved_games':women_unresolved,
            'scope':'NCAA-origin women D-I feed through attributed delivery; verified shared school ID crosswalk'}
        out['sources'].append({'source':women_origin['provider']+' (women)','url':women_origin['source_url'],'ok':True,
                               'resolved':len(women_rows),'unresolved':women_unresolved})
    except Exception as exc:
        out['sources'].append({'source':'NCAA-origin women scoreboard','url':women_url,
                               'ok':False,'error':type(exc).__name__})
    # Verify individual player totals against NCAA-origin FINAL scores. These
    # records remain separate from ESPN player aggregates and RETRO Elo.
    # Limit network calls and retain certified previous games by NCAA ID.
    existing=out.get('ncaa_player_boxscores') or {}
    safe_games={gid:record for gid,record in (existing.get('games') or {}).items()
                if isinstance(record,dict) and str(gid).isdigit()}
    audited={'eligible':0,'accepted':0,'rejected_or_unavailable':0,'requests':0}
    xref_by_espn={str(t['espn_id']):t for t in
                  (json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())
                   .get('teams') or []) if t.get('espn_id')}
    qualified=[]
    for gender,key in (('men','ncaa_crosscheck'),('women','ncaa_women_crosscheck')):
        source=out.get(key) or {}
        if source.get('day') != ncaa_day or source.get('checked_at') != now:
            continue
        for game in source.get('games') or []:
            if game.get('phase') == 'final' and str(game.get('ncaa_id') or '').isdigit():
                qualified.append((gender,game))
    for gender,game in qualified[:8]:
        gid=str(game['ncaa_id'])
        audited['eligible']+=1
        if gid in safe_games:continue
        expected={}
        if gender=='men':
            for side in ('away','home'):
                team=xref_by_espn.get(str(game.get(side+'_id')))
                tid=str((team or {}).get('id') or '').removeprefix('ncaa:')
                if tid.isdigit():expected[side]=tid
        url='https://ncaa-api.henrygd.me/game/'+gid+'/boxscore'
        audited['requests']+=1
        try:
            data=json.loads(fetch(url))
            candidate=parse_ncaa_player_boxscore(data,{**game,'gender':gender},expected)
            if candidate:
                candidate['checked_at']=now
                safe_games[gid]=candidate
                audited['accepted']+=1
            else:
                audited['rejected_or_unavailable']+=1
                # Schema-only diagnostics, never publish raw unverified stats.
                root=data.get('data',data) if isinstance(data,dict) else {}
                raw=root.get('boxscore',root) if isinstance(root,dict) else {}
                blocks=raw.get('teamBoxscore',[]) if isinstance(raw,dict) else []
                if not isinstance(blocks,list):blocks=[]
                info={'ncaa_id':gid,'top_keys':list(data)[:8] if isinstance(data,dict) else [],
                      'box_keys':list(raw)[:12] if isinstance(raw,dict) else [],
                      'ncaa_team_ids':[str(x.get('teamId','')) for x in blocks[:2]
                                       if isinstance(x,dict)],
                      'expected_team_ids':expected,
                      'player_counts':[len(x.get('playerStats',[])) for x in blocks[:2]
                         if isinstance(x,dict) and isinstance(x.get('playerStats'),list)],
                      'team_box_keys':[list(x)[:16] for x in blocks[:2] if isinstance(x,dict)],
                      'team_stat_keys':[list(x.get('teamStats',{}))[:22] for x in blocks[:2]
                         if isinstance(x,dict) and isinstance(x.get('teamStats'),dict)],
                      'team_info':[(str(x.get('teamId','')),x.get('isHome')) for x in
                         ((raw.get('teams') or []) if isinstance(raw,dict) else [])[:2]
                         if isinstance(x,dict)]}
                audited.setdefault('rejection_shapes',[]).append(info)
        except Exception as exc:
            audited['rejected_or_unavailable']+=1
            audited.setdefault('errors',{}).setdefault(type(exc).__name__,0)
            audited['errors'][type(exc).__name__]+=1
    out['ncaa_player_boxscores']={'checked_at':now,'day':ncaa_day,
        'provenance':'NCAA.com data delivered by third-party relay; not independent second publisher',
        'scope':'Only verified final games with exact player-to-final point reconciliation',
        'games':dict(list(safe_games.items())[-180:]),'audit':audited}
    out['sources'].append({'source':'NCAA-origin verified player boxscores',
        'ok':bool(audited['accepted'] or safe_games),
        'accepted_new':audited['accepted'],'requests':audited['requests'],
        'rejected_or_unavailable':audited['rejected_or_unavailable'],
        'certified_total':len(safe_games)})
    # Completed regular-season games only; keyed storage makes repeated ingestion idempotent.
    statpath=ROOT/'data/mbb-current-player-stats.json'
    playerdata=json.loads(statpath.read_text()) if statpath.exists() else {'season':'2026-27','games':{},'players':[]}
    if dt.date(2026,11,1)<=dt.datetime.now().date()<=dt.date(2027,4,30):
        try:
            yesterday=(dt.datetime.now(ZoneInfo('America/New_York'))-dt.timedelta(days=1)).strftime('%Y%m%d')
            events=result.get('events',[]) if 'result' in locals() else []
            events+=json.loads(fetch(score_url.replace(day,yesterday))).get('events',[])
            cross=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())
            lookup={str(t['espn_id']):t['id'] for t in cross['teams'] if t.get('espn_id')}
            finals={e['id']:e for e in events if e.get('status',{}).get('type',{}).get('completed') and e.get('season',{}).get('year')==2027 and e.get('season',{}).get('type') in (2,3)}
            for event_id in list(finals)[:50]:
                box=json.loads(fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event='+event_id))
                rows=parse_boxscore(box,lookup)
                if rows:playerdata['games'][event_id]=rows
            playerdata['players']=aggregate(playerdata['games']);playerdata['as_of']=now
        except Exception as e:out['sources'].append({'source':'Player box scores','ok':False,'error':type(e).__name__})
    statpath.write_text(json.dumps(playerdata,separators=(',',':'))+'\n')
    # Team branding is refreshed weekly, independently of the news and scores.
    branding=ROOT/'data/mbb-branding.json'
    if not branding.exists() or dt.datetime.now().timestamp()-branding.stat().st_mtime>7*86400:
        try:
            result=json.loads(fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000&groups=50'))
            rows=result['sports'][0]['leagues'][0]['teams']
            brands={x['team']['id']:{k:x['team'].get(k) for k in ('color','alternateColor','displayName','abbreviation')} for x in rows}
            if len(brands)>300:branding.write_text(json.dumps({'as_of':now,'teams':brands},separators=(',',':'))+'\n')
        except Exception:pass
    OUT.write_text(json.dumps(out,separators=(',',':'))+'\n')
    print(json.dumps({'news':len(out.get('articles',[])),'games':len(out.get('games',[])),'sources':out['sources']}))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Recover MIAA 2026-27 DII conference fixtures from TWO official school calendars.

Every published fixture requires independent date and home/away agreement from
both universities; school-page identity, gender and season are verified first.
We never overwrite NCAA IDs, statuses, scores, venues or broadcasts. The MIAA
lists local clock times without a reliable zone, so none are inferred as ET.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from bs4 import BeautifulSoup

BASE = 'https://themiaa.com/schedule.aspx?schedule='
SEASON = '2026-27'
# These IDs have been checked against the official 2026-27 school-page titles;
# do not use numeric adjacency without independent owner/gender confirmation.
SOURCES = {
 'men': {3115:'emporia',3116:'forthays',3118:'missourisouthern',3120:'missouriwestern',
         3122:'newman',3124:'northeastern',3126:'northwest',3127:'pittsburg',
         3128:'rogers',3129:'arkansasfortsmith',3130:'centralmissouri',
         3131:'centraloklahoma',3132:'nebraskakearney',3133:'washburn'},
 'women': {3117:'emporia',3119:'forthays',3121:'missourisouthern',3123:'missouriwestern',
           3125:'newman',3134:'northeastern',3135:'northwest',3136:'pittsburg',
           3137:'rogers',3138:'arkansasfortsmith',3139:'centralmissouri',
           3140:'centraloklahoma',3142:'nebraskakearney',3143:'washburn'}
}
# Nebraska Kearney has two public women page IDs (3141 and 3142) with a
# nonconference-date discrepancy. Use 3142 only, never double-count calendars.
ALIASES = {
 'arkansasfortsmith': ('Arkansas Fort Smith','Arkansas-Fort Smith','Arkansas–Fort Smith',
                       'University of Arkansas-Fort Smith','University of Arkansas Fort Smith'),
 'centralmissouri': ('Central Missouri','University of Central Missouri'),
 'centraloklahoma': ('Central Oklahoma','University of Central Oklahoma'),
 'emporia': ('Emporia State','Emporia State University'),
 'forthays': ('Fort Hays State','Fort Hays State University'),
 'missourisouthern': ('Missouri Southern','Missouri Southern State',
                     'Missouri Southern State University'),
 'missouriwestern': ('Missouri Western','Missouri Western State',
                    'Missouri Western State University'),
 'nebraskakearney': ('Nebraska Kearney','Nebraska-Kearney','Nebraska–Kearney',
                    'University of Nebraska at Kearney'),
 'newman': ('Newman','Newman University'),
 'northeastern': ('Northeastern State','Northeastern State University'),
 'northwest': ('Northwest Missouri','Northwest Missouri State',
               'Northwest Missouri State University'),
 'pittsburg': ('Pittsburg State','Pittsburg State University'),
 'rogers': ('Rogers State','Rogers State University'),
 'washburn': ('Washburn','Washburn University')
}
CONFERENCES = {'MIAA','Mid-America Intercollegiate Athletics Association',
               'Mid America Intercollegiate Athletics Association'}

def norm(value):
    return ' '.join(re.sub(r'[^a-z0-9]+',' ',str(value or '').lower().replace('&',' and ')).split())

LOOKUP = {}
for key,names in ALIASES.items():
    for name in names:
        token=norm(name)
        if token in LOOKUP and LOOKUP[token] != key:
            raise ValueError('MIAA school alias collision: '+name)
        LOOKUP[token]=key

def school(value):
    return LOOKUP.get(norm(value))

def fetch(url):
    request=urllib.request.Request(url,headers={
        'User-Agent':'SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)',
        'Accept':'text/html'})
    with urllib.request.urlopen(request,timeout=18) as response:
        return response.read(1_750_000).decode('utf-8','replace')

def parse(html, gender, sid):
    if gender not in SOURCES or sid not in SOURCES[gender]:
        raise ValueError('MIAA unknown gender or source ID')
    soup=BeautifulSoup(html,'html.parser')
    title=soup.title.get_text(' ',strip=True) if soup.title else ''
    title=title.replace('’',"'")
    m=re.search(r"2026[-–](?:2027|27)\s+(.+?)\s+(Men's|Women's)\s+Basketball\b",title,re.I)
    owner=SOURCES[gender][sid]
    if (not m or ('women' if m[2].lower().startswith('women') else 'men')!=gender
        or school(m[1])!=owner or 'mid-america intercollegiate athletics association' not in title.lower()):
        raise ValueError('MIAA wrong school/season/gender/league in official title: '+str(sid))
    rows=[]; rejected=0; has_grid=False
    for table in soup.select('table'):
        for tr in table.select('tr'):
            columns=[norm(th.get_text(' ',strip=True)) for th in tr.find_all('th',recursive=False)]
            if not {'date','opponent','location','time result'}.issubset(set(columns)):
                continue
            has_grid=True
            date_i=columns.index('date'); opp_i=columns.index('opponent')
            for game_tr in table.select('tr'):
                cells=[td.get_text(' ',strip=True) for td in game_tr.find_all('td',recursive=False)]
                if len(cells)<=max(date_i,opp_i):continue
                raw_date=cells[date_i].strip(); raw_opp=cells[opp_i].strip()
                if not re.fullmatch(r'\d{1,2}/\d{1,2}/20(?:26|27)',raw_date):
                    rejected+=1;continue
                try:day=dt.datetime.strptime(raw_date,'%m/%d/%Y').date()
                except ValueError:rejected+=1;continue
                if not dt.date(2026,11,1)<=day<=dt.date(2027,3,1):continue
                if ('exhibition' in raw_opp.lower() or re.match(r'^vs\.?\s+',raw_opp,re.I)
                    or 'tournament' in raw_opp.lower()):
                    rejected+=1;continue
                road=bool(re.match(r'^at\s+',raw_opp,re.I))
                opp=school(re.sub(r'^at\s+','',raw_opp,flags=re.I))
                if opp is None or opp==owner:
                    rejected+=1;continue
                away,home=(owner,opp) if road else (opp,owner)
                rows.append((day.isoformat(),away,home,owner))
            break
        if has_grid:break
    if not has_grid or len(rows)<8:
        raise ValueError('MIAA official university school grid has fewer than eight conference fixtures: '+str(sid))
    return rows,rejected

def identities(teams):
    mapping={}; ambiguous=set()
    for ident,record in teams.items():
        if record.get('conference') not in CONFERENCES:continue
        if record.get('not_eligible_for_dii_elo'):continue
        key=school(record.get('name'))
        if not key:continue
        if key in mapping and mapping[key]!=ident:ambiguous.add(key)
        else:mapping[key]=ident
    for key in ambiguous:mapping.pop(key,None)
    return mapping,sorted(ambiguous)

def enrich_miaa(gender,games,teams,today=None,fetcher=fetch):
    if gender not in SOURCES:raise ValueError('Unknown MIAA gender')
    today=today or dt.date.today()
    identity,ambiguous=identities(teams)
    if len(identity)<12 or ambiguous:
        return {'status':'MIAA identity validation incomplete; withheld',
                'teams_identified':len(identity),'ambiguous':ambiguous,'added':0,'enriched':0}
    loaded={};errors=[];rejected=0
    with ThreadPoolExecutor(max_workers=10) as pool:
        tasks={pool.submit(fetcher,BASE+str(sid)):sid for sid in SOURCES[gender]}
        for future in as_completed(tasks):
            sid=tasks[future]
            try:
                rows,invalid=parse(future.result(),gender,sid)
                loaded[SOURCES[gender][sid]]=(sid,rows)
                rejected+=invalid
            except Exception as exc:
                errors.append({'source':sid,'school':SOURCES[gender][sid],
                               'reason':str(exc)[:155]})
    if len(loaded)<12:
        return {'status':'MIAA fewer than twelve official university calendars; withheld',
                'schools_read':len(loaded),'unavailable':errors,'added':0,'enriched':0}
    observed=defaultdict(dict);duplicate=0
    for owner,(sid,rows) in loaded.items():
        for date,away,home,witness in rows:
            key=(date,away,home)
            if witness in observed[key]:
                observed[key][witness]=None;duplicate+=1
            else:
                observed[key][witness]=sid
    previous=defaultdict(list)
    for game in games.values():
        if game.get('date') and game.get('away') and game.get('home'):
            previous[(game['date'],frozenset((game['away'],game['home'])))].append(game)
    added=enriched=one_sided=conflicts=reciprocal=0
    for (day,away,home),votes in sorted(observed.items()):
        if set(votes)!={away,home} or None in votes.values():
            one_sided+=1;continue
        if away not in identity or home not in identity:
            rejected+=1;continue
        reciprocal+=1
        a,h=identity[away],identity[home]
        matches=previous.get((day,frozenset((a,h))),[])
        if len(matches)>1:
            conflicts+=1;continue
        urls=sorted(BASE+str(sid) for sid in votes.values())
        if matches:
            old=matches[0]
            if old.get('away')!=a or old.get('home')!=h or old.get('neutral'):
                conflicts+=1;continue
            before=old.get('official_schedule_sources') or []
            combined=sorted(set(before).union(urls))
            old['official_schedule_sources']=combined
            if combined!=before:enriched+=1
            continue
        if dt.date.fromisoformat(day)<today:continue
        gid=f'd2miaa-2026-{gender}-{day}-{away}-{home}'
        if gid in games:
            conflicts+=1;continue
        game={'id':gid,'date':day,'away':a,'home':h,'status':'scheduled',
              'away_score':None,'home_score':None,'verified':True,
              'neutral':False,'elo_eligible':True,'conference_game':True,
              'source':'MIAA 2026-27 two-university official schedules',
              'source_url':urls[0],'official_schedule_sources':urls}
        games[gid]=game
        previous[(day,frozenset((a,h)))].append(game)
        added+=1
    return {'status':'MIAA 2026-27 reciprocal school schedules verified',
            'gender':gender,'source_school_calendars':len(loaded),
            'teams_identified':len(identity),'reciprocal_games':reciprocal,
            'added':added,'enriched':enriched,'one_sided':one_sided,
            'quarantined':rejected+duplicate+conflicts,'conflicts':conflicts,
            'unavailable':errors,'source':BASE}

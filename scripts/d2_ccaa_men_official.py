#!/usr/bin/env python3
"""2026-27 CCAA MEN: strict reciprocal university conference-calendar recovery.

Uses thirteen league-hosted university schedules (not a league composite) plus
UC Merced's own university schedule, each with exact school/year/gender gates.
Every fixture requires two DIFFERENT schools confirming day and away/home roles.
Calendar time is recorded as ET only if both independent Pacific-local clocks
agree; all contradictory, partial, neutral and duplicated evidence is held.
Preserve NCAA game ID, verified final, existing venue/network and Elo fields.
"""
from __future__ import annotations
import datetime as dt
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

BASE='https://goccaa.org/schedule.aspx?schedule='
MERCED='https://ucmercedbobcats.com/sports/mens-basketball/schedule/2026-27?grid=true'
SOURCES={
 5197:'humboldt',5198:'pomona',5199:'dominguez',5200:'eastbay',
 5201:'la',5202:'monterey',5203:'sanbernardino',5204:'sanmarcos',
 5205:'chico',5206:'fresno',5207:'menlo',5208:'sanfrancisco',
 5209:'stanislaus'
}
ALIASES={
 'humboldt':('Cal Poly Humboldt','Cal State Humboldt','Humboldt State','Humboldt'),
 'pomona':('Cal Poly Pomona','California State Polytechnic University Pomona'),
 'dominguez':('Cal State Dominguez Hills','CSU Dominguez Hills','Cal St. Dom. Hills','Cal St Dom Hills'),
 'eastbay':('Cal State East Bay','CSU East Bay','Cal St. East Bay','Cal St East Bay'),
 'la':('Cal State LA','Cal State Los Angeles','Cal St. Los Angeles','Cal St. LA','CSU Los Angeles','California State University Los Angeles'),
 'monterey':('Cal State Monterey Bay','CSU Monterey Bay','Cal St. Monterey Bay','Cal St Monterey Bay'),
 'sanbernardino':('Cal State San Bernardino','CSU San Bernardino','Cal St. San Bernardino','Cal St San Bernardino'),
 'sanmarcos':('Cal State San Marcos','CSU San Marcos','Cal St. San Marcos','Cal St San Marcos'),
 'chico':('Chico State','California State University Chico','Chico St'),
 'fresno':('Fresno Pacific','Fresno Pacific University'),
 'menlo':('Menlo','Menlo College'),
 'sanfrancisco':('San Francisco State','San Francisco St','SF State','San Fran. St.'),
 'stanislaus':('Stanislaus State','Cal State Stanislaus','California State University Stanislaus','Stanislaus St.'),
 'merced':('UC Merced','University of California Merced','University of California, Merced')
}
CONFERENCES={'CCAA','California Collegiate Athletic Association'}
def norm(v):
    return ' '.join(re.sub(r'[^a-z0-9]+',' ',str(v or '').lower().replace('&',' and ')).split())
LOOKUP={}
for key,names in ALIASES.items():
    for name in names:
        n=norm(name)
        if n in LOOKUP and LOOKUP[n]!=key:raise ValueError('CCAA alias collision: '+name)
        LOOKUP[n]=key
def school(v):return LOOKUP.get(norm(v))
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':
        'SportingLifeTimes/1.0 (+https://github.com/jbryancoburn-netizen/sporting-life-times)',
        'Accept':'text/html'})
    with urllib.request.urlopen(req,timeout=20) as response:
        return response.read(1_800_000).decode('utf-8','replace')
def clock_pt(v):
    val=' '.join(str(v or '').strip().upper().replace('.','').split())
    m=re.fullmatch(r'(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*([AP])M',val)
    if not m:return None
    hh=int(m[1])%12+(12 if m[3]=='P' else 0)
    return dt.time(hh,int(m[2] or 0))
def eastern(day,clock):
    if clock is None:return None
    moment=dt.datetime.combine(dt.date.fromisoformat(day),clock,
                                tzinfo=ZoneInfo('America/Los_Angeles'))
    return moment.astimezone(ZoneInfo('America/New_York')).strftime('%I:%M %p').lstrip('0')+' ET'
def parse_league(html,sid):
    if sid not in SOURCES:raise ValueError('Unregistered CCAA source')
    soup=BeautifulSoup(html,'html.parser')
    title=soup.title.get_text(' ',strip=True).replace('’',"'") if soup.title else ''
    m=re.search(r"2026[-–](?:2027|27)\s+(.+?)\s+Men's\s+Basketball\b",title,re.I)
    owner=SOURCES[sid]
    if not m or school(m[1])!=owner or 'ccaa' not in title.lower():
        raise ValueError(f'Wrong school/season/gender/conference in CCAA page {sid}: '+title[:120])
    best=None;rejected=0
    for table in soup.select('table'):
        for tr in table.select('tr'):
            heads=[norm(th.get_text(' ',strip=True)) for th in tr.find_all('th',recursive=False)]
            if not {'date','opponent','location','time result'}.issubset(set(heads)):
                continue
            date_i=heads.index('date');opp_i=heads.index('opponent')
            time_i=heads.index('time result')
            # The official league school grid's five columns are:
            # Date / [conference asterisk] / Opponent / Location / Time/Result.
            if len(heads)!=5 or date_i!=0 or opp_i!=2 or time_i!=4:
                raise ValueError('Unexpected CCAA school-calendar column layout')
            rows=[]
            for row in table.select('tr'):
                c=[td.get_text(' ',strip=True) for td in row.find_all('td',recursive=False)]
                if len(c)!=5:continue
                date_raw,flag,opponent,_,wall_clock=[v.strip() for v in c]
                if '*' not in flag:continue
                if not re.fullmatch(r'\d{1,2}/\d{1,2}/20(?:26|27)',date_raw):
                    rejected+=1;continue
                try:day=dt.datetime.strptime(date_raw,'%m/%d/%Y').date().isoformat()
                except ValueError:rejected+=1;continue
                if not '2026-11-01'<=day<='2027-03-01':continue
                if re.match(r'^vs\.?\s+',opponent,re.I) or 'exhibition' in opponent.lower():
                    rejected+=1;continue
                road=bool(re.match(r'^at\s+',opponent,re.I))
                rival=school(re.sub(r'^at\s+','',opponent,flags=re.I))
                if not rival or rival==owner:
                    rejected+=1;continue
                away,home=(owner,rival) if road else (rival,owner)
                rows.append((day,away,home,owner,clock_pt(wall_clock)))
            if best is None or len(rows)>len(best):best=rows
            break
    # Fresno Pacific's official league calendar currently flags only six
    # of its games with the conference asterisk. Treat this as a PARTIAL
    # university source instead of falsely discarding the whole school;
    # unstarred games never become league fixtures through this importer.
    minimum=6 if owner=='fresno' else 12
    if best is None or len(best)<minimum:
        raise ValueError(f'CCAA page {sid} has fewer than {minimum} recognizable conference games')
    return owner,best,rejected
def parse_merced(html):
    soup=BeautifulSoup(html,'html.parser')
    title=soup.title.get_text(' ',strip=True).replace('’',"'") if soup.title else ''
    full=' '.join(soup.get_text(' ',strip=True).lower().split())[:3000]
    if (not re.search(r'2026[-–](?:2027|27).*men.s basketball',title,re.I) or
        'merced' not in (title+' '+full).lower()):
        raise ValueError('Wrong gender, institution, or year at UC Merced')
    best=[]
    for table in soup.select('table'):
        for tr in table.select('tr'):
            head=[norm(h.get_text(' ',strip=True)) for h in tr.find_all('th',recursive=False)]
            if not {'date','time','at','opponent','location'}.issubset(head):continue
            di=head.index('date');ti=head.index('time');ri=head.index('at');oi=head.index('opponent')
            rows=[]
            for row in table.select('tr'):
                c=[td.get_text(' ',strip=True) for td in row.find_all('td',recursive=False)]
                if len(c)<=max(di,ti,ri,oi):continue
                match=re.search(r'([A-Za-z]+)\s+(\d{1,2}),\s+(2026|2027)',c[di])
                if not match:continue
                try:day=dt.datetime.strptime(match[0],'%B %d, %Y').date().isoformat()
                except ValueError:continue
                if not '2026-11-01'<=day<='2027-03-01':continue
                role=norm(c[ri])
                if role not in ('home','away'):continue
                rival=school(c[oi])
                if not rival or rival=='merced':continue
                away,home=('merced',rival) if role=='away' else (rival,'merced')
                rows.append((day,away,home,'merced',clock_pt(c[ti])))
            if len(rows)>len(best):best=rows
            break
    if len(best)<12:raise ValueError('UC Merced official men's schedule has too few CCAA opponents')
    return 'merced',best,0
def identities(teams):
    index={};ambiguous=set()
    for ident,t in teams.items():
        if t.get('conference') not in CONFERENCES:continue
        key=school(t.get('name')) or school(ident.replace('-',' '))
        if not key or t.get('not_eligible_for_dii_elo'):continue
        if key in index and index[key]!=ident:ambiguous.add(key)
        else:index[key]=ident
    for key in ambiguous:index.pop(key,None)
    return index,sorted(ambiguous)
def enrich_ccaa_men(games,teams,today=None,fetcher=fetch):
    today=today or dt.date.today()
    ids,ambiguous=identities(teams)
    if len(ids)<13 or ambiguous:
        return {'status':'CCAA institutional identities incomplete; held',
                'teams_identified':len(ids),'ambiguous':ambiguous,'added':0,'enriched':0}
    sources={};failed=[];rejected=0
    urls={key:BASE+str(key) for key in SOURCES}
    urls['merced']=MERCED
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs={pool.submit(fetcher,url):sid for sid,url in urls.items()}
        for future in as_completed(jobs):
            sid=jobs[future]
            try:
                owner,rows,bad=(parse_merced(future.result()) if sid=='merced'
                                else parse_league(future.result(),sid))
                if owner in sources:raise ValueError('Duplicate calendar owner')
                sources[owner]=(urls[sid],rows);rejected+=bad
            except Exception as exc:
                failed.append({'source':str(sid),'reason':str(exc)[:160]})
    if len(sources)<13:
        return {'status':'CCAA fewer than thirteen valid university calendars; held',
                'schools_read':len(sources),'unavailable':failed,'added':0,'enriched':0}
    witnesses=defaultdict(dict);duplicated=0
    for owner,(url,rows) in sources.items():
        for day,away,home,source,clock in rows:
            if owner!=source:raise ValueError('Source owner mismatch')
            key=(day,away,home)
            if owner in witnesses[key]:
                duplicated+=1;witnesses[key][owner]=None
            else:witnesses[key][owner]=(url,clock)
    existing=defaultdict(list)
    for g in games.values():
        if g.get('date') and g.get('away') and g.get('home'):
            existing[(g['date'],frozenset((g['away'],g['home'])))].append(g)
    added=enriched=one_sided=conflicts=reciprocal=time_conflicts=tipoffs=0
    for (day,away,home),seen in sorted(witnesses.items()):
        if set(seen)!={away,home} or None in seen.values():
            one_sided+=1;continue
        if away not in ids or home not in ids:
            rejected+=1;continue
        reciprocal+=1
        a,h=ids[away],ids[home]
        match=existing.get((day,frozenset((a,h))),[])
        if len(match)>1:
            conflicts+=1;continue
        urls=sorted(x[0] for x in seen.values())
        if match:
            g=match[0]
            if g.get('away')!=a or g.get('home')!=h or g.get('neutral'):
                conflicts+=1;continue
            before=g.get('official_schedule_sources') or []
            now=sorted(set(before).union(urls))
            if before!=now:g['official_schedule_sources']=now;enriched+=1
        else:
            if day<today.isoformat():continue
            gid=f'd2ccaa-2026-men-{day}-{away}-{home}'
            if gid in games:conflicts+=1;continue
            g={'id':gid,'date':day,'away':a,'home':h,'status':'scheduled',
               'away_score':None,'home_score':None,'verified':True,'neutral':False,
               'elo_eligible':True,'conference_game':True,
               'source':'CCAA 2026-27 two-university official calendars',
               'source_url':urls[0],'official_schedule_sources':urls}
            games[gid]=g
            existing[(day,frozenset((a,h)))].append(g)
            added+=1
        clocks=[x[1] for x in seen.values()]
        if all(clocks) and clocks[0]==clocks[1]:
            if not g.get('start_time'):
                g['start_time']=eastern(day,clocks[0]);g['tipoff_source_url']=urls[0]
                tipoffs+=1
        elif clocks[0] and clocks[1] and clocks[0]!=clocks[1]:
            time_conflicts+=1
    return {'status':'CCAA 2026-27 exact two-university men fixtures verified',
            'gender':'men','schools_read':len(sources),'reciprocal_games':reciprocal,
            'added':added,'enriched':enriched,'one_sided':one_sided,
            'quarantined':rejected+duplicated+conflicts,
            'conflicts':conflicts,'time_disagreements':time_conflicts,
            'mutually_verified_et_tipoffs':tipoffs,
            'unavailable':failed,'source':BASE}

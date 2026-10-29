#!/usr/bin/env python3
"""Fill missing fields from archived official conference game-by-game releases.

Only an exact date and both uniquely resolved team IDs may match. Existing
announced values survive older releases. No venue or neutral-site inference.
"""
import collections, datetime, json, pathlib, re, sys
from bs4 import BeautifulSoup
import mbb_reconcile_saved_official_evidence as identities

DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
EVIDENCE = DATA / 'mbb-official-conference-game-evidence.json'
ALIASES = {'connecticut':'41', 'detroit':'2174', 'md-easternshore':'2379',
           'westga.':'2698', 'niu':'2459', 'purdue-fortwayne':'2870',
           'ut-chattanooga':'236', 'bostonu.':'104', 'southernu.':'2582',
           'lindenwood(mo)':'2815', 'st.thomas(mn)':'2900',
           'albany':'399', 'arkansaspine-bluff':'2029', 'army':'349',
           'loyola(md)':'2352', 'purdue-ft.wayne':'2870',
           'samhoustonstate':'2534', 'texas-sanantonio':'2636',
           'appalachianstate':'2026','gramblingstate':'2755',
           'georga':'61','kanasstate':'2306'}

def team_id(name, source_url=''):
    key = re.sub(r'\s+', '', identities.m.clean_school_label(name).lower())
    # The Big Ten release's USC is its member Southern California.
    if key == 'usc' and 'bigtensports' in source_url: return '30'
    if key == 'usc' and 'big12sports.com' in source_url: return '30'
    if key == 'miami' and 'secsports.com' in source_url: return '2390'
    return ALIASES.get(key) or identities.resolve(name)

def big_east(text, url):
    assert "2026-27 BIG EAST Men's Basketball Television Schedule" in text
    rows = []
    for line in text.splitlines():
        line = re.sub(r'^L\d+:\s*', '', line)
        cells = [x.strip() for x in line.split('|')]
        if len(cells) != 4: continue
        date, time, matchup, tv = cells
        match = re.search(r'\b(Nov|Dec|Jan|Feb|March)\.?\s+(\d{1,2})\b', date)
        sides = re.split(r'\s+(at|vs\.)\s+', matchup)
        if not match or len(sides) != 3: continue
        month = {'Nov':11,'Dec':12,'Jan':1,'Feb':2,'March':3}[match[1]]
        a, relation, b = sides
        rows.append(dict(date=f'{2026 if month>6 else 2027}-{month:02d}-{int(match[2]):02d}',
                         visitor=a, host=b, relation=relation, time=time,
                         tv=tv, city='', source_url=url))
    return rows

def big_ten(text, url):
    assert 'Time (ET)' in text and 'Visiting Team' in text
    rows = []
    for line in text.splitlines():
        cells = re.split(r'\s{2,}', line.strip())
        if len(cells) != 8: continue
        date, a, relation, b, city, state, tv, time = cells
        try: date = datetime.datetime.strptime(date, '%A, %B %d, %Y').date().isoformat()
        except ValueError: continue
        if relation not in ('at', 'vs.'): continue
        rows.append(dict(date=date, visitor=a, host=b, relation=relation,
                         time=time, tv=tv, city=f'{city}, {state}', source_url=url))
    return rows

def sec_release(html, url):
    """Expand actual HTML rowspans before carrying blank dates forward."""
    soup = BeautifulSoup(html,'html.parser')
    assert 'SEC on ESPN Networks 2026-27' in soup.get_text(' ',strip=True)
    spans = {}; rows = []; date = ''; note = ''
    for tr in soup.select('tr'):
        cells = {}; column = 0
        for col, (remaining, text) in list(spans.items()):
            cells[col] = text
            if remaining == 1: del spans[col]
            else: spans[col] = (remaining-1,text)
        for td in tr.find_all(['td','th'],recursive=False):
            while column in cells: column += 1
            text = td.get_text(' ',strip=True); cells[column] = text
            if int(td.get('rowspan',1)) > 1: spans[column] = (int(td['rowspan'])-1,text)
            column += 1
        if set(cells) != {0,1,2,3}: continue
        rawdate, time, matchup, tv = [cells[x] for x in range(4)]
        m = re.search(r'\b(Oct|Nov|Dec|Jan|Feb|Mar)\s+(\d{1,2})\b',rawdate)
        if m:
            month = {'Oct':10,'Nov':11,'Dec':12,'Jan':1,'Feb':2,'Mar':3}[m[1]]
            date = f'{2026 if month>6 else 2027}-{month:02d}-{int(m[2]):02d}'
        sides = re.split(r'\s+(?:at|vs\.)\s+',matchup)
        if len(sides) != 2:
            note = matchup; continue
        # Some event captions say "at" even at a neutral showcase.
        if date and date >= '2026-11-01' and 'Exhibition' not in note:
            rows.append(dict(date=date,visitor=sides[0],host=sides[1],relation='unspecified',
                             time=time,tv=tv,city='',source_url=url))
        note = ''
    return rows

def big_twelve(text,url):
    assert '2026-27 Big 12' in text and 'Time (ET)' in text
    rows = []
    for line in text.splitlines():
        for part in re.split(r'(?=(?:Nov|Dec|Jan|Feb|Mar)\. \d)',line):
            m = re.match(r'(Nov|Dec|Jan|Feb|Mar)\. (\d{1,2})\s+(.+?)\s+((?:[\d:/]+\s*(?:a|p)\.m\.|Noon(?:/[\d:]+\s*p\.m\.)?))\s+(.+?)\s*$',part)
            if not m: continue
            month, day, matchup, time, tv = m.groups()
            sides = re.split(r'\s+(at|vs\.)\s+',matchup)
            if len(sides) != 3: continue
            month = {'Nov':11,'Dec':12,'Jan':1,'Feb':2,'Mar':3}[month]
            rows.append(dict(date=f'{2026 if month>6 else 2027}-{month:02d}-{int(day):02d}',
                             visitor=sides[0],host=sides[2],relation=sides[1],time=time,tv=tv,city='',source_url=url))
    return rows

def recover(facts):
    documents = {p.stem: json.loads(p.read_text()) for p in (DATA/'mbb-schedules-2026-27').glob('*.json')}
    report = []; total = collections.Counter(); changed = set(); unresolved = []
    for row in facts['rows']:
        a, b = team_id(row['visitor'],row['source_url']), team_id(row['host'],row['source_url'])
        if not a or not b or a == b:
            unresolved.append({**row, 'visitor_id':a, 'host_id':b}); continue
        row['visitor_id'], row['host_id'] = a, b
        for owner, opponent in [(a,b),(b,a)]:
            matches = []
            for e in documents.get(owner,{}).get('events',[]):
                ps = e['competitions'][0]['competitors']
                ids = {str(x.get('team',{}).get('id') or '') for x in ps}
                if e['date'][:10] == row['date'] and ids == {a,b}: matches.append(e)
            if len(matches) != 1: continue
            e = matches[0]; c = e['competitions'][0]; counts = collections.Counter()
            url = row['source_url']; total['calendar_games_matched'] += 1
            # A release's TBD never replaces a newer school announcement.
            tv = row['tv']
            if not re.search('TBD|TBA',tv,re.I) and tv and not (c.get('broadcasts') or e.get('broadcasts')):
                c['broadcasts'] = [{'names':[tv], 'source_url':url}]
                e['broadcast_source_url'] = url; counts['broadcasts_added'] += 1
            time = row['time']
            old = e.get('official_school_time') or e.get('official_time') or ''
            if re.fullmatch(r'(?:\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?|Noon)',time,re.I) and (not old or re.search('TBA|TBD',old,re.I)):
                e['official_school_time'] = time + ' ET'
                e['official_school_time_source'] = url; counts['tipoffs_added'] += 1
            if row['relation'] == 'at':
                if not e.get('site_verified'):
                    for p in c['competitors']:
                        p['homeAway'] = 'away' if str(p['team']['id']) == a else 'home'
                    e.update(site_verified=True, neutralSite=False, site_source_url=url)
                    e.pop('site_conflict',None); counts['sites_verified'] += 1
                v = c.setdefault('venue',{})
                if row['city'] and not (v.get('official_school_city') or v.get('address',{}).get('city')):
                    v.update(official_school_city=row['city'],city_source_url=url); counts['cities_added'] += 1
            if counts:
                changed.add(owner); total.update(counts)
                report.append({'id':owner,'event_id':e['id'],'date':row['date'], 'opponent_id':opponent,'source_url':url,**counts})
    for owner in changed:
        (DATA/'mbb-schedules-2026-27'/f'{owner}.json').write_text(json.dumps(documents[owner],ensure_ascii=False,separators=(',',':'))+'\n')
    summary = {'schools_updated':len(changed),'source_rows':len(facts['rows']),**total}
    result = {'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':summary,'changes':report,'unresolved_rows':unresolved}
    (DATA/'mbb-conference-schedule-recovery.json').write_text(json.dumps(result,indent=2)+'\n')
    EVIDENCE.write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary)); print('Unresolved:', sorted({(r['visitor'],r['host']) for r in unresolved}))

if __name__ == '__main__':
    if len(sys.argv) == 3:
        facts = {'season':'2026-27','timezone':'ET','rows':
            big_east(pathlib.Path(sys.argv[1]).read_text(),'https://www.bigeast.com/news/2026/10/5/full-2026-27-big-east-mens-basketball-television-schedule-released.aspx') +
            big_ten(pathlib.Path(sys.argv[2]).read_text(),'https://s3.amazonaws.com/sidearm.sites/bigtensports.sidearmsports.com/documents/2026/10/6/2026_27_Big_Ten_MBB_TV_Schedule_Release.pdf')}
    else: facts = json.loads(EVIDENCE.read_text())
    recover(facts)

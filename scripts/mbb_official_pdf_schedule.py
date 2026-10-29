#!/usr/bin/env python3
"""Import Notre Dame's linked official schedule PDF when its web grid is empty."""
import json,re,pathlib,tempfile,subprocess,datetime,requests,importlib.util,collections
from bs4 import BeautifulSoup
sp=importlib.util.spec_from_file_location('fields',pathlib.Path(__file__).with_name('mbb_complete_official_fields.py'));m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
PAGE='https://fightingirish.com/sports/mbball/schedule'
html=requests.get(PAGE,timeout=18);html.raise_for_status();soup=BeautifulSoup(html.text,'html.parser')
payload=json.loads(soup.select_one('#__NUXT_DATA__').get_text())
def ref(v):return payload[v] if type(v)is int and 0<=v<len(payload) else v
pdfs=[]
for obj in payload:
 if not isinstance(obj,dict) or obj.get('schedule_events_pdf') is None:continue
 item=ref(obj['schedule_events_pdf'])
 if isinstance(item,dict) and re.search('2026-27.*MBB',str(ref(item.get('title'))),re.I):pdfs.append(ref(item.get('url')))
assert len(set(pdfs))==1,'Official page must link one matching basketball PDF'
url=pdfs[0];res=requests.get(url,timeout=18);res.raise_for_status();assert res.content.startswith(b'%PDF')
with tempfile.TemporaryDirectory(prefix='mbb-pdf-') as tmp:
 p=pathlib.Path(tmp)/'schedule.pdf';p.write_bytes(res.content);textpath=pathlib.Path(tmp)/'schedule.txt'
 subprocess.run(['pdftotext','-layout',str(p),str(textpath)],check=True)
 text=textpath.read_text()
assert '2026-27 SCHEDULE' in text and 'TIME (ALL ET)' in text
aliases={'scstate':'2569','cal':'25','pitt':'221','floridast':'52','ncstate':'152','miami':'2390'}
team=next(t for t in m.TEAMS if str(t['espn_id'])=='87');byid={str(t['espn_id']):t for t in m.TEAMS};rows=[]
for line in text.splitlines():
 cells=re.split(r'\s{2,}',line.strip())
 if len(cells)!=6 or not re.fullmatch(r'\d{1,2}/\d{1,2}',cells[0]):continue
 rawdate,time,opponent,city,arena,tv=cells;month,day=map(int,rawdate.split('/'))
 away=opponent.startswith('@');opponent=re.sub(r'^@\s*|\s*[+^!*]\s*$','',opponent).strip()
 if '/' in opponent or re.search(r'\bTBD|TBA|Tournament\b',opponent,re.I):continue
 key=m.norm(opponent);options=[t for t in m.TEAMS if key in {m.norm(t['name']),m.norm(t.get('espn_name'))}]
 other=byid.get(aliases.get(key,'')) or (options[0] if len(options)==1 else None)
 if other is None:
  options=[t for t in m.TEAMS if m.norm(t.get('espn_name','')).startswith(key) and len(m.norm(t.get('espn_name','')))>len(key)]
  other=options[0] if len(options)==1 else None
 assert other is not None,opponent
 # PDF explicitly marks away opponents with @; retain other existing site evidence.
 rows.append(dict(date=f'{2026 if month>=7 else 2027}-{month:02d}-{day:02d}',opponent=other['name'],opponent_id=str(other['espn_id']),opponent_original=opponent,time=time+' ET' if time not in ('TBA','TBD') else time,arena=arena,city=city,tv=tv,site='away' if away else '',site_explicit=away,exhibition=False))
assert len(rows)==30
path=m.DATA/'mbb-schedules-2026-27/87.json';d=json.loads(path.read_text());count=collections.Counter()
for e in d['events']:
 c=e['competitions'][0];ps=c['competitors'];own=next((x for x in ps if str(x.get('team',{}).get('id'))=='87'),None);other=next((x for x in ps if x is not own),{})
 candidates=[r for r in rows if r['date']==e['date'][:10] and r['opponent_id']==str(other.get('team',{}).get('id'))]
 if len(candidates)!=1:continue
 r=candidates[0];count['games_matched']+=1
 venue=c.setdefault('venue',{})
 for key,value in [('arenaName',r['arena']),('official_school_city',r['city'])]:
  if venue.get(key)!=value:venue[key]=value;count['fields_updated']+=1
 venue['arena_source_url']=url;venue['city_source_url']=url
 e['official_school_time']=r['time'];e['official_school_time_source']=url
 c['broadcasts']=[{'names':[r['tv']],'source_url':url}];e['broadcast_source_url']=url
 if r['site']=='away':own['homeAway']='away';other['homeAway']='home';e.update(site_verified=True,site_source_url=url,neutralSite=False)
count['games_added']=m.add_missing_games(d,team,rows,url)
d['source_url']=url;d['official_schedule_page']=PAGE
path.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
(m.DATA/'mbb-official-game-evidence/87.json').write_text(json.dumps({'source_url':url,'schedule_page':PAGE,'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows},ensure_ascii=False,separators=(',',':'))+'\n')
(m.DATA/'mbb-official-pdf-recovery.json').write_text(json.dumps({'source_url':url,'confirmed_named_games':len(rows),'summary':dict(count)},indent=2)+'\n');print(json.dumps(dict(count)))

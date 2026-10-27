#!/usr/bin/env python3
"""Last two 2026-27 men's basketball calendars: USI athletics official grid, CCSU transparent fallback."""
import datetime,json,pathlib,re,urllib.request
from bs4 import BeautifulSoup
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'data/mbb-schedules-2026-27'
teams=json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
byid={str(t['espn_id']):t for t in teams}
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html'})
 with urllib.request.urlopen(req,timeout=35) as r:return BeautifulSoup(r.read(),'html.parser')
def make(eid,items,source,url,direct):
 t=byid[eid];rows=[]
 for n,e in enumerate(items):
  date=e['date'];other=e['opponent'];site=e.get('site','neutral')
  selfdata={'team':{'id':eid,'displayName':t.get('espn_name') or t['name']},'homeAway':site}
  opp={'team':{'id':'','displayName':other},'homeAway':'away' if site=='home' else 'home' if site=='away' else 'neutral'}
  rows.append({'id':f'finishing-{eid}-{date}-{n}','date':date+'T12:00:00-05:00','official_time':e.get('time','TBA'),
   'name':other,'school_source_url':url,'competitions':[{'competitors':[selfdata,opp],'venue':{'fullName':e.get('venue','')},'broadcasts':[]}],
   'source_verified':direct})
 payload={'season':'2026-27','espn_team_id':eid,'team_id':t['id'],'source_name':source,'source_url':url,
  'verified_from_school':direct,'source_method':'direct-school-athletics' if direct else 'independent-secondary-fallback',
  'coverage':'full published dates, pending source confirmation' if direct else 'secondary-source schedule; not directly university verified',
  'fetched_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'events':rows}
 (out/(eid+'.json')).write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 return len(rows)
def usi():
 url='https://usiscreamingeagles.com/sports/mens-basketball/schedule/2026-2027?grid=true'
 soup=fetch(url);items=[]
 for table in soup.select('table'):
  heads=[' '.join(h.stripped_strings).casefold() for h in table.select('thead th')]
  if not heads:heads=[' '.join(h.stripped_strings).casefold() for h in table.select('tr th')]
  if not any('opponent' in x for x in heads) or not any('date' in x for x in heads):continue
  col={k:next((i for i,v in enumerate(heads) if k in v),-1) for k in ['date','time','at','opponent','location']}
  for tr in table.select('tbody tr'):
   cells=[' '.join(c.stripped_strings) for c in tr.find_all('td',recursive=False)]
   if any(i<0 or i>=len(cells) for i in (col['date'],col['opponent'])):continue
   date=cells[col['date']]
   try:
    d=datetime.datetime.strptime(re.sub(r'\\s*\\([^)]+\\)','',date).strip(),'%B %d, %Y').date()
   except ValueError:continue
   if d.year not in (2026,2027):continue
   opp=cells[col['opponent']]
   if re.search(r'first round|quarterfinal|semifinal|championship|tbd|tba|winner of',opp,re.I):continue
   val=lambda k: cells[col[k]] if 0<=col[k]<len(cells) else ''
   items.append({'date':d.isoformat(),'opponent':opp,'time':val('time'),'site':val('at').casefold(),'venue':val('location')})
  if items:break
 if len(items)<28:raise ValueError('USI verified grid incomplete: '+str(len(items)))
 return make('s_usi',items,'Official Southern Indiana Athletics 2026-27 calendar',url,True)
def ccsu():
 url='https://www.sports-reference.com/cbb/schools/central-connecticut-state/men/2027-schedule.html'
 soup=fetch(url);items=[]
 for tr in soup.select('table#schedule tbody tr'):
  if 'thead' in tr.get('class',[]):continue
  date=tr.select_one('[data-stat="date_game"]')
  opp=tr.select_one('[data-stat="opp_name"]')
  if not date or not opp:continue
  val=lambda key: ' '.join(tr.select_one('[data-stat="'+key+'"]').stripped_strings) if tr.select_one('[data-stat="'+key+'"]') else ''
  raw=' '.join(date.stripped_strings)
  try:d=datetime.datetime.strptime(raw.replace(',',''),'%a %b %d %Y').date()
  except ValueError:
   try:d=datetime.datetime.strptime(raw,'%a, %b %d, %Y').date()
   except ValueError:continue
  site='away' if val('game_location')=='@' else 'neutral' if val('game_location')=='N' else 'home'
  items.append({'date':d.isoformat(),'opponent':' '.join(opp.stripped_strings),'time':val('game_time'),'site':site,'venue':val('arena')})
 if len(items)<20:raise ValueError('CCSU secondary source incomplete: '+str(len(items)))
 return make('s_ccsu',items,'Sports-Reference 2026-27 CCSU schedule (secondary source)',url,False)
cross={t['name']:str(t['espn_id']) for t in teams}
report={}
for name,key,fn in [('Southern Ind.','s_usi',usi),('Central Conn. St.','s_ccsu',ccsu)]:
 try:
  globals()[key]=cross[name]
  report[name]={'status':'published','games':fn()}
 except Exception as e:report[name]={'status':'failed','error':str(e)}
(out/'final-two-import-status.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if any(x['status']!='published' for x in report.values()):raise SystemExit('Some schedules remain unverified')

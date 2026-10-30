#!/usr/bin/env python3
"""Import named games from the broadcaster's official 2026-27 PDF grid.
No wildcard, unnamed tournament slot, unknown team, or date-only matching.
"""
import json,re,sys,pathlib,collections
import mbb_conference_schedule_recovery as r
URL='https://espnpressroom.com/wp-content/uploads/26_27MBBGrid_v4.pdf'
def configure():
 r.ALIASES.update({'usc':'30','miami':'2390','siu-edwardsville':'2565','citadel':'2643','unc-asheville':'2427','unc-wilmington':'350','unc-greensboro':'2430','etsu':'2193','ut-martin':'2630','utep':'2638'})
def parse(raw):
 configure();rows=[];excluded=[];day='';seen=set()
 for item in raw:
  cells=item['cells'];cells=cells[::3] if len(cells)==12 else cells
  if len(cells)!=4:continue
  date,time,game,tv=[x or '' for x in cells]
  if 'Time (ET)' in time or game=='Game':continue
  if date:
   m=re.search(r'\b(Nov|Dec|Jan|Feb|Mar)\s+(\d{1,2})\b',date)
   if not m:day='';continue
   month={'Nov':11,'Dec':12,'Jan':1,'Feb':2,'Mar':3}[m[1]];day=f'{2026 if month>6 else 2027}-{month:02d}-{int(m[2]):02d}'
  tv=re.sub(r'\s+',' ',tv).strip().replace('*','')
  if not day or not tv:continue
  parts=game.splitlines();options={}
  for start in range(len(parts)):
   name=' '.join(parts[start:]);sides=re.split(r'\s+(at|vs\.)\s+',name)
   if len(sides)!=3:continue
   a,rel,b=sides;a=r.identities.m.clean_school_label(a);b=r.identities.m.clean_school_label(b)
   ai,bi=r.team_id(a,URL),r.team_id(b,URL)
   if ai and bi and ai!=bi:options[(ai,bi)]=(a,rel,b)
  if len(options)!=1:
   excluded.append({'date':day,'page':item['page'],'game':game,'reason':'no unique pair of named Division I teams'});continue
  (ai,bi),(a,rel,b)=next(iter(options.items()));key=(day,ai,bi)
  if key in seen:continue
  seen.add(key)
  rows.append(dict(date=day,visitor=a,host=b,relation=rel,time=re.sub(r'\s+',' ',time).strip(),timezone='ET',tv=tv,city='',source_url=URL,source_page=item['page'],source_game_text=game))
 return rows,excluded
def unmatched(rows):
 documents={p.stem:json.loads(p.read_text()) for p in (r.DATA/'mbb-schedules-2026-27').glob('*.json')}
 issues=[]
 for row in rows:
  a,b=row['visitor_id'],row['host_id']
  for owner in (a,b):
   candidates=[e for e in documents.get(owner,{}).get('events',[]) if {str(p.get('team',{}).get('id','')) for p in e['competitions'][0]['competitors']}=={a,b}]
   exact=[e for e in candidates if e['date'][:10]==row['date']]
   if len(exact)!=1:issues.append({'owner_id':owner,'date':row['date'],'visitor':row['visitor'],'host':row['host'],'other_dates':[e['date'][:10] for e in candidates],'reason':'no unique exact date and team-ID match'})
 return issues
if __name__=='__main__':
 rows,excluded=parse(json.loads(pathlib.Path(sys.argv[1]).read_text()))
 assert len(rows)>500,(len(rows),len(excluded))
 r.EVIDENCE=r.DATA/'mbb-network-grid-evidence.json';r.REPORT=r.DATA/'mbb-network-grid-recovery.json'
 r.recover({'season':'2026-27','rows':rows,'excluded_rows':excluded})

 report=json.loads(r.REPORT.read_text());report['unmatched_calendar_entries']=unmatched(rows);r.REPORT.write_text(json.dumps(report,indent=2)+'\n')

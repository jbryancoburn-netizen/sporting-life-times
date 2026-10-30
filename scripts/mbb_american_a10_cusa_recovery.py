#!/usr/bin/env python3
"""Match official American/A10 composite PDFs and CUSA broadcast tables."""
import collections,datetime,json,pathlib,re,sys
import mbb_conference_schedule_recovery as recovery
AAC='https://s3.amazonaws.com/sidearm.sites/theamerican.sidearmsports.com/documents/2026/10/26/2026_27_American_Men_s_Basketball_Composite_Schedule.pdf'
A10='https://s3.amazonaws.com/atlantic10.com/documents/2026/10/21/2627_MBB_Composite_TV_times.pdf'
CUSA='https://conferenceusa.com/news/2026/10/14/mbb-cusa-announces-mens-basketball-broadcast-schedule.aspx'
MONTHS={'November':11,'December':12,'January':1,'February':2,'March':3}
ALIASES={'mtsu':'2393','jaxstate':'55','nmstate':'166','wku':'98','semo':'2546',
 'nccentral':'2428','marylandeasternshore':'2379','selaouisiana':'2545','selouisiana':'2545',
 'latech':'2348','centralconnecticut':'2115','unt':'249','calstatenorthridge':'2463',
 'siueedwardsville':'2565','floridagulfcoast':'526','charlestonsouthern':'2127',
 'semissouristate':'2546','texasa&mcorpuschristi':'357','texasa&mcc':'357',
 'charleston':'232','collegeofcharleston':'232','stlouis':'139','floridaatlantic':'2226',
 'bethune-cookeman':'2065','usc':'30'}
def date_header(line):
 m=re.fullmatch(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (November|December|January|February|March) (\d{1,2})',line)
 if not m:return ''
 month=MONTHS[m[1]]
 return f'{2026 if month>6 else 2027}-{month:02d}-{int(m[2]):02d}'
def row(date,a,b,relation,time,tv,url):
 return dict(date=date,visitor=a.strip(),host=b.strip(' *'),relation=relation,time=time,tv=tv,timezone='ET',city='',source_url=url)
def american(text):
 assert '2026-27' in text and 'All times Eastern' in text
 rows=[];date='';pending=''
 for raw in text.splitlines():
  line=raw.strip();day=date_header(line)
  if day:date=day;pending='';continue
  # Superscript event numbers may become their own line in PDF extraction.
  if pending:line=pending+' '+line;pending=''
  if not re.search(r'\s(?:at|vs\.?)\s',line):continue
  m=re.match(r'(.+?)\s+(at|vs\.?)\s+(.+?)\s+(ESPN(?:\+|2|U)?|CBSSN|FS1|ACCNX?|truTV|TNT|FOX|YouTube|FloSports|TBD)\s+(.+)$',line)
  if not m:
   if re.search(r'\d+$',line):pending=line
   continue
  a,rel,b,tv,time=m.groups();b=re.sub(r'\s*\d+$','',b).strip(' *')
  if re.search(r'TBA|TBD|/',b,re.I):continue
  if date:rows.append(row(date,a,b,'at' if rel=='at' else 'vs.',time,tv,AAC))
 return rows
def atlantic(text):
 assert '2026-27' in text and 'All times Eastern' in text
 rows=[];date=''
 for line in text.splitlines():
  line=line.strip();day=date_header(line)
  if day:date=day;continue
  m=re.match(r'(.+?)\s+(at|vs\.)\s+(.+?)\s+(\d{1,2}(?::\d\d)?\s*[ap]m)\s+(ESPN[2U]?|CBSSN|USA Network|CBS)$',line)
  if m and date:
   a,rel,b,time,tv=m.groups();rows.append(row(date,a,b,rel,time,tv,A10))
 return rows
def cusa(text):
 assert 'AWAY TEAM' in text and 'TIME (ET)' in text
 rows=[]
 for line in text.splitlines():
  line=re.sub(r'^L\d+:\s*','',line);cells=[x.strip() for x in line.split('|')]
  if len(cells)!=5:continue
  date,a,b,tv,time=cells
  try:date=datetime.datetime.strptime(date,'%m/%d/%Y').date().isoformat()
  except ValueError:continue
  if re.search('TBA|TBD',a,re.I):continue
  rows.append(row(date,a,b,'at',time,tv,CUSA))
 return rows
def unambiguous(rows):
 grouped=collections.defaultdict(list)
 for r in rows:grouped[(r['source_url'],r['date'],r['visitor'],r['host'])].append(r)
 result=[];conflicts=[]
 for key,items in grouped.items():
  values={(r['time'],r['tv']) for r in items}
  if len(values)==1:result.append(items[0])
  else:conflicts.append({'date':key[1],'teams':list(key[2:]),'source_url':key[0],'claims':list(values)})
 return result,conflicts
if __name__=='__main__':
 recovery.ALIASES.update(ALIASES)
 rows,conflicts=unambiguous(american(pathlib.Path(sys.argv[1]).read_text())+atlantic(pathlib.Path(sys.argv[2]).read_text())+cusa(pathlib.Path(sys.argv[3]).read_text()))
 recovery.EVIDENCE=recovery.DATA/'mbb-american-a10-cusa-game-evidence.json'
 recovery.REPORT=recovery.DATA/'mbb-american-a10-cusa-recovery.json'
 recovery.recover({'season':'2026-27','rows':rows,'conflicting_source_rows_excluded':conflicts})

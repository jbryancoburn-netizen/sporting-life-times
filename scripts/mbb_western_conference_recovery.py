#!/usr/bin/env python3
"""Read the official MW composite PDF and Pac-12 broadcast release.
MW times are local and omitted; Pac-12 explicitly labels every time PT.
"""
import pathlib,re,json,sys,unicodedata
import mbb_conference_schedule_recovery as recovery
MW='https://s3.amazonaws.com/sidearm.sites/mountainwest.sidearmsports.com/documents/2026/9/29/2026_27_MW_MBB_Composite.pdf'
PAC='https://pac-12.com/news/2026/10/14/2026-27-pac-12-mens-basketball-broadcast-schedule-information-announced.aspx'
MONTHS={'November':11,'December':12,'January':1,'February':2,'March':3}
def lines(text):
 for line in text.splitlines():
  yield re.sub(r'^L\d+:\s*','',line).strip()
def day_header(line):
 m=re.fullmatch(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (November|December|January|February|March) (\d{1,2})',line)
 if not m:return ''
 month=MONTHS[m[1]]
 return f'{2026 if month>6 else 2027}-{month:02d}-{int(m[2]):02d}'
def school(s):
 s=s.replace('’',"'").replace('é','e').strip(' *')
 return {'Hawai\'i':'Hawaii','San Jose State':'San Jose St.','UW Milwaukee':'Milwaukee',
         'Loyola (Chicago)':'Loyola Chicago','Texas A&M Corpus Christi':'A&M-Corpus Christi',
         'McNeese State':'McNeese','Louisiana Monroe':'ULM','North Alabama':'North Ala.',
         'Southern':'Southern U.'}.get(s,s)
def pac_rows(text):
 assert '2026-27 Pac-12' in text and 'All times listed PT' in text
 result=[];date=''
 for line in lines(text):
  header=day_header(line)
  if header:date=header;continue
  m=re.match(r'(.+?)\s+((?:\d{1,2}(?::\d\d)?\.?\s*[ap]\.m\.)|TBD)\s+(USA|The CW|CBSSN|CBS)$',line)
  if not m or not date:continue
  matchup,time,tv=m.groups();sides=re.split(r'\s+(at|vs\.)\s+',matchup)
  if len(sides)!=3:continue
  time=re.sub(r'(\d)\.\s+([ap])',r'\1 \2',time)
  result.append(dict(date=date,visitor=school(sides[0]),host=school(sides[2]),relation=sides[1],time=time,tv='USA Network' if tv=='USA' else tv,timezone='PT',city='',source_url=PAC))
 return result
def mw_rows(text):
 assert '2026-27 Mountain West' in text and 'All times are local' in text
 result=[];date=''
 for line in lines(text):
  header=day_header(line)
  if header:date=header;continue
  m=re.match(r'(.+?)\s+(at|vs\.)\s+(.+?)\s+TBA$',line)
  if not m or not date:continue
  a,relation,b=m.groups();network=re.search(r'\((MW\+|CW|FS1|CBSSN|CBS|FOX)\)',b)
  tv=network[1] if network else ''
  b=re.sub(r'\s*\([^)]*\)','',b).strip(' *')
  # Conditional opponents cannot identify an earned fixture.
  if '/' in b or re.search('TBA|TBD',b):continue
  result.append(dict(date=date,visitor=school(a),host=school(b),relation=relation,time='',tv='The CW' if tv=='CW' else tv,city='',source_url=MW))
 return result
if __name__=='__main__':
 facts={'season':'2026-27','rows':pac_rows(pathlib.Path(sys.argv[1]).read_text())+mw_rows(pathlib.Path(sys.argv[2]).read_text())}
 recovery.EVIDENCE=recovery.DATA/'mbb-western-conference-game-evidence.json'
 recovery.REPORT=recovery.DATA/'mbb-western-conference-recovery.json'
 recovery.recover(facts)

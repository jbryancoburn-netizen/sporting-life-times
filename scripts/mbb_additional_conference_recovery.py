#!/usr/bin/env python3
"""Recover announced WCC/CAA/MAC/MVC fields and A10 fallback streams.
Wildcard television candidates are never treated as selected broadcasts.
"""
import pathlib,re,sys
import mbb_conference_schedule_recovery as recovery
import mbb_american_a10_cusa_recovery as previous
WCC='https://wccsports.com/news/2026/10/14/wcc-sets-games-times-for-mens-basketball-national-television-selections.aspx'
CAA='https://caasports.com/news/2026/10/14/caa-slates-27-mens-basketball-games-on-cbs-sports-network-for-2026-27-season.aspx'
MAC='https://getsomemaction.com/news/2026/10/14/mac-announces-2026-27-mens-basketball-national-tv-schedule.aspx'
MVC='https://s3.amazonaws.com/sidearm.sites/mvc.sidearmsports.com/documents/2026/10/19/2026_27_MVC_Mens_Basketball_Productions_on_ESPN_Platforms.pdf'
A10_POLICY='https://admin.atlantic10.com/news/2026/10/14/atlantic-10-announces-tip-times-for-84-national-tv-games-in-mens-basketball.aspx'
def date(text):
 m=re.search(r'\b(Nov|Dec|Jan|Feb|Mar)[a-z]*\.?\s+(\d{1,2})\b',text)
 if not m:return ''
 month={'Nov':11,'Dec':12,'Jan':1,'Feb':2,'Mar':3}[m[1]]
 return f'{2026 if month>6 else 2027}-{month:02d}-{int(m[2]):02d}'
def announcement_rows(text):
 rows=[]
 for section in text.split('--------------------------------------------------------------------------------'):
  url=next((x for x in [WCC,CAA,MAC] if x in section),'')
  if not url:continue
  network='CBSSN'
  for line in section.splitlines():
   line=re.sub(r'^L\d+:\s*','',line).strip()
   cells=[x.strip() for x in line.split('|')]
   if url==WCC and len(cells)==5:
    _,day,match,time,tv=cells;day=date(day);sides=match.split(' at ')
    if day and len(sides)==2:
     rows.append(dict(date=day,visitor=sides[0],host=sides[1],relation='at',time=time,tv=tv,timezone='PT',city='',source_url=url))
   elif url==CAA and len(cells)==3:
    day,match,time=cells;day=date(day);sides=match.split(' at ')
    if day and len(sides)==2:
     # The table does not explicitly state a time zone.
     rows.append(dict(date=day,visitor=sides[0],host=sides[1],relation='at',time='',tv='CBSSN',city='',source_url=url))
   elif url==MAC:
    if line=='ESPN':network=''
    if line=='CBS Sports Network':network='CBSSN'
    day=date(line)
    m=re.search(r'\d{1,2}\s*[–—-]+\s*(.+?)\s+@\s+(.+?),\s*(\d{1,2}(?::\d\d)?\s*pm)\s+ET(?:\s*\((ESPN2|ESPNU)\))?',line,re.I)
    if day and m:
     a,b,time,tv=m.groups();tv=tv or network
     if tv:rows.append(dict(date=day,visitor='Miami (OH)' if a=='Miami' else a,host='Miami (OH)' if b=='Miami' else b,relation='at',time=time,tv=tv,timezone='ET',city='',source_url=url))
 return rows
def mvc_rows(text):
 assert '2026-27 MVC MEN' in text and 'Central Time' in text
 rows=[];day=''
 for line in text.splitlines():
  found=date(line)
  if found:day=found
  if '%' in line or not day:continue
  m=re.search(r"([A-Za-z][A-Za-z .’'-]*?) @ (.+?) \(MBB -- (ESPN\+|ESPN2|ESPNU)\)\s+(.+)$",line)
  if not m:continue
  a,b,tv,tail=m.groups();parts=re.split(r'\s{2,}',tail.strip());city=parts[0];time=parts[1] if len(parts)==2 else ''
  rows.append(dict(date=day,visitor=a.strip(),host=b.strip(),relation='at',time=time,tv=tv,timezone='CT',city=city,source_url=MVC))
 return rows
def a10_stream_rows(text):
 """Use the A10's explicit streaming rule for unselected composite fixtures.
 The official Oct. 21 composite identifies its selected national TV games;
 the league states that all games outside that package stream on ESPN+.
 """
 assert '2026-27' in text and 'All times Eastern' in text
 rows=[];day=''
 for line in text.splitlines():
  line=line.strip();found=previous.date_header(line)
  if found:day=found;continue
  m=re.fullmatch(r"([A-Za-z .’'-]+) at ([A-Za-z .’'-]+)",line)
  if day and m and day<='2027-03-06':
   a,b=m.groups();rows.append(dict(date=day,visitor=a,host=b,relation='at',time='',tv='ESPN+',city='',source_url=A10_POLICY,fixture_source_url=previous.A10,broadcast_evidence_method='explicit_league_streaming_rule_for_games_outside_selected_national_package'))
 return rows
if __name__=='__main__':
 recovery.ALIASES.update({'usc':'30','charleston':'232','southernillinois':'79'})
 rows=announcement_rows(pathlib.Path(sys.argv[1]).read_text())+mvc_rows(pathlib.Path(sys.argv[2]).read_text())+a10_stream_rows(pathlib.Path(sys.argv[3]).read_text())
 recovery.EVIDENCE=recovery.DATA/'mbb-additional-conference-game-evidence.json'
 recovery.REPORT=recovery.DATA/'mbb-additional-conference-recovery.json'
 recovery.recover({'season':'2026-27','rows':rows})

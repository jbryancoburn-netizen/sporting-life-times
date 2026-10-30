#!/usr/bin/env python3
"""Refresh the publicly readable 2026-27 KenPom top 25 without replacing verified data on error."""
import datetime,json,pathlib,re,requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/'data/mbb-external-top25.json'
URL='https://kenpom.com/index.php?y=2027'
today=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
try:
 response=requests.get(URL,headers={'User-Agent':'Mozilla/5.0 (compatible; SportingLifeTimes/1.0)'},timeout=25)
 response.raise_for_status()
 soup=BeautifulSoup(response.text,'html.parser')
 table=soup.select_one('table#ratings-table')
 if table is None: raise ValueError('KenPom ratings table not present')
 rows=[]
 for tr in table.select('tbody tr'):
  cells=tr.find_all('td',recursive=False)
  if len(cells)<3: continue
  rank_text=cells[0].get_text(' ',strip=True)
  rank_match=re.match(r'^\s*(\d+)\b',rank_text)
  if not rank_match: continue
  rank=int(rank_match.group(1))
  if rank>25:continue
  team=cells[1].get_text(' ',strip=True)
  team=re.sub(r'\s+\d+$','',team).strip()
  if not team:continue
  rows.append({'rank':rank,'team':team})
 unique={v['rank']:v for v in rows}
 if len(unique)!=25 or sorted(unique)!=list(range(1,26)):raise ValueError(f'expected 25 distinct ranked teams, got {len(unique)}')
 if not ('2027' in soup.get_text(' ',strip=True)[:1200] or '2027' in response.url):raise ValueError('season 2027 not confirmed')
 data=json.loads(DEST.read_text()) if DEST.exists() else {'season':'2026-27'}
 data['season']='2026-27'
 data['kenpom']={'status':'published','rankings':[unique[i] for i in range(1,26)],'source_url':URL,'retrieved_at':today,'season':'2026-27'}
 data.setdefault('net',{'status':'not_yet_released','rankings':[],'source_url':'https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings','season':'2026-27'})
 DEST.write_text(json.dumps(data,indent=2)+'\n')
 print('Published KenPom 2026-27 Top 25:',len(unique))
except Exception as exc:
 print('::warning::KenPom source unavailable or validation failed; preserving last verified snapshot:',str(exc))

# NET is not published until the NCAA releases current-season results.
# Only accept an explicitly season-labeled official NCAA ranking table.
try:
 if datetime.datetime.now(datetime.timezone.utc).month in (12,1,2,3,4):
  net_url='https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings'
  resp=requests.get(net_url,headers={'User-Agent':'Mozilla/5.0'},timeout=25)
  resp.raise_for_status()
  page=BeautifulSoup(resp.text,'html.parser')
  whole=page.get_text(' ',strip=True)
  if not re.search(r'2026\\s*[-–/]\\s*27|2026-27',whole,re.I):raise ValueError('official NCAA page does not establish 2026–27 season')
  rows=[]
  for tr in page.select('table tr'):
   cells=tr.find_all(['th','td'],recursive=False)
   if len(cells)<2:continue
   rank_text=cells[0].get_text(' ',strip=True)
   if not re.fullmatch(r'\\d{1,3}',rank_text):continue
   rank=int(rank_text)
   if rank>25:continue
   school=cells[1].get_text(' ',strip=True)
   if not school or len(school)>85:continue
   rows.append({'rank':rank,'team':school})
  found={r['rank']:r for r in rows}
  if len(found)!=25 or sorted(found)!=list(range(1,26)):raise ValueError('official NET top 25 incomplete or unknown table layout')
  data=json.loads(DEST.read_text())
  data['net']={'status':'published','rankings':[found[i] for i in range(1,26)],'source_url':net_url,'season':'2026-27','retrieved_at':today}
  DEST.write_text(json.dumps(data,indent=2)+'\n')
  print('Published official 2026-27 NET Top 25')
except Exception as exc:
 print('::warning::Official NET unavailable/unverified; preserving existing feed:',str(exc))


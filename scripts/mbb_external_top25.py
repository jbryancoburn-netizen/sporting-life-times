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

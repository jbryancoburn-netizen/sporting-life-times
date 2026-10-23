#!/usr/bin/env python3
"""Source-attributed NBA injuries and transactions. Fail closed on empty data."""
import json,re
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/nba-roster-wire-snapshot.json'
def fetch(url):
 with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'}),timeout=15) as r:return json.load(r)
def main():
 now=datetime.now(timezone.utc)
 old=json.loads(OUT.read_text()) if OUT.exists() else {}
 injured=[];moves=[];errors=[]
 # ESPN NBA injury API returns individual athlete, status and team attribution.
 for url in ('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries',
             'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'):
  try:
   data=fetch(url)
   groups=data.get('injuries') or data.get('teams') or []
   for group in groups:
    team=group.get('team') or {}
    code=team.get('abbreviation') or group.get('abbreviation') or ''
    for p in group.get('injuries') or []:
     athlete=p.get('athlete') or {}
     name=athlete.get('displayName') or p.get('displayName') or ''
     status=p.get('status') or ''
     detail=p.get('type') or p.get('description') or ''
     if isinstance(status,dict):status=status.get('name') or status.get('description') or ''
     if isinstance(detail,dict):detail=detail.get('description') or detail.get('name') or ''
     if name and status:injured.append(dict(player=name,team=code,status=str(status),detail=str(detail)[:90]))
   if injured:break
  except (OSError,ValueError,TypeError,KeyError) as e:errors.append('Injury endpoint: '+str(e)[:120])
 # Transactions from ESPN public transactions JSON; schema may vary.
 for url in ('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/transactions',
             'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/transactions?limit=50'):
  try:
   data=fetch(url)
   for entry in data.get('transactions') or data.get('items') or []:
    if not isinstance(entry,dict):continue
    athlete=entry.get('athlete') or {}
    name=athlete.get('displayName') or entry.get('playerName') or ''
    team=entry.get('team') or {}
    code=team.get('abbreviation','') if isinstance(team,dict) else ''
    desc=entry.get('description') or entry.get('type') or ''
    date=str(entry.get('date') or entry.get('effectiveDate') or '')[:10]
    if name and desc and date:moves.append(dict(date=date,team=code,player=name,action=str(desc)[:120]))
   if moves:break
  except (OSError,ValueError,TypeError,KeyError) as e:errors.append('Transaction endpoint: '+str(e)[:120])
 if not injured and not moves:
  print('No new source records; preserving existing dated snapshot:',errors)
  return
 new=dict(old)
 if injured:
  new['injuries']=injured[:120]
  new['injuries_as_of']=now.isoformat()
  new['injuries_source']='https://www.espn.com/nba/injuries'
 if moves:
  new['transactions']=moves[:120]
  new['transactions_as_of']=now.isoformat()
  new['transactions_source']='https://www.nba.com/players/transactions'
 new['as_of']=now.date().isoformat()
 new['snapshot']=False
 new['feed_errors']=errors
 OUT.write_text(json.dumps(new,indent=2,ensure_ascii=False)+'\n')
 print('Wire records:',len(new.get('injuries',[])),len(new.get('transactions',[])))
if __name__=='__main__':main()

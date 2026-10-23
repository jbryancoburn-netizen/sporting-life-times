#!/usr/bin/env python3
"""Backfill 2026-27 NBA completed player box scores from attributed ESPN game summaries.
Never mixes partial in-progress games or overwrites stronger captured records.
"""
import json,sys,time
from datetime import datetime,timedelta,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/nba-game-center.json'
BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/'
ALIASES={'NY':'NYK','GS':'GSW','SA':'SAS','NO':'NOP','UTAH':'UTA','WSH':'WAS'}
def fetch(url):
 req=Request(url,headers={'Accept':'application/json','User-Agent':'Mozilla/5.0'})
 with urlopen(req,timeout=16) as response:return json.load(response)
def parse_summary(event,summary):
 teams=(event.get('competitions') or [{}])[0].get('competitors') or []
 byside={v.get('homeAway'):v for v in teams}
 if not all(x in byside for x in ('home','away')):return None
 box=(summary.get('boxscore') or {})
 out={'id':'espn-nba-'+str(event['id']),'date':event.get('date'),'state':'post','status':'Final',
      'url':'https://www.espn.com/nba/game/_/gameId/'+str(event['id']),'teams':[], 'players':[],
      'leaders':[],'source':'ESPN completed-game box score'}
 for side in ('away','home'):
  t=byside[side]
  out['teams'].append({'name':t.get('team',{}).get('displayName',''),'code':ALIASES.get(t.get('team',{}).get('abbreviation'),t.get('team',{}).get('abbreviation')),'score':int(t.get('score') or 0),'home_away':side})
 for team in box.get('players') or []:
  code=ALIASES.get((team.get('team') or {}).get('abbreviation'),(team.get('team') or {}).get('abbreviation'))
  for section in team.get('statistics') or []:
   labels=section.get('labels') or []
   keys=[x.upper() for x in (section.get('keys') or labels)]
   def val(record,*names):
    stats=record.get('stats') or []
    for n in names:
     for candidates in (keys,[x.upper() for x in labels]):
      if n in candidates:
       i=candidates.index(n)
       if i<len(stats):return stats[i]
    return None
   def num(raw):
    try:return int(float(raw))
    except (ValueError,TypeError):return 0
   def split(raw):
    a=str(raw or '0-0').split('-')
    return (num(a[0]),num(a[1])) if len(a)==2 else (0,0)
   for p in section.get('athletes') or []:
    ath=p.get('athlete') or {}
    if p.get('didNotPlay') or p.get('ejected') and not p.get('stats'):continue
    if not p.get('stats'):continue
    fgm,fga=split(val(p,'FG','FIELDGOALSMADE-FIELDGOALSATTEMPTED'))
    tpm,tpa=split(val(p,'3PT','THREEPOINTFIELDGOALSMADE-THREEPOINTFIELDGOALSATTEMPTED'))
    ftm,fta=split(val(p,'FT','FREETHROWSMADE-FREETHROWSATTEMPTED'))
    row={'id':str(ath.get('id') or ''),'name':ath.get('displayName') or ath.get('fullName'),
         'team':code,'min':str(val(p,'MIN','MINUTES') or ''),
         'pts':num(val(p,'PTS','POINTS')),'reb':num(val(p,'REB','TOTALREBOUNDS')),
         'ast':num(val(p,'AST','ASSISTS')),'stl':num(val(p,'STL','STEALS')),
         'blk':num(val(p,'BLK','BLOCKS')),'tov':num(val(p,'TO','TURNOVERS')),
         'fgm':fgm,'fga':fga,'fg3m':tpm,'fg3a':tpa,'ftm':ftm,'fta':fta}
    if row['id'] and row['name'] and code:out['players'].append(row)
 if not out['players']:return None
 out['leaders']=sorted(out['players'],key=lambda p:(-p['pts'],-p['reb'],-p['ast']))[:5]
 return out
def main():
 now=datetime.now(timezone.utc)
 old=json.loads(OUT.read_text()) if OUT.exists() else {'games':[]}
 prior={str(g['id']):g for g in old.get('games',[]) if g.get('id')}
 first=datetime(2026,10,20,tzinfo=timezone.utc)
 dates=[first+timedelta(days=n) for n in range((now-first).days+1)]
 candidates=[]
 for date in dates:
  day=date.strftime('%Y%m%d')
  try:
   data=fetch(BASE+'scoreboard?dates='+day+'&limit=100')
   for e in data.get('events') or []:
    if e.get('status',{}).get('type',{}).get('completed') is not True or int((e.get('season') or {}).get('type') or 0)!=2:continue
    if 'espn-nba-'+str(e['id']) not in prior:candidates.append(e)
  except (OSError,ValueError,TypeError) as exc:print('ESPN scoreboard unavailable',day,exc)
 candidates=candidates[:50]
 def collect(e):
  try:return parse_summary(e,fetch(BASE+'summary?event='+str(e['id'])))
  except (OSError,ValueError,TypeError,KeyError) as exc:
   print('Game summary unavailable',e.get('id'),exc);return None
 with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(collect,candidates))
 for g in results:
  if g and g.get('players'):prior[g['id']]=g
 games=sorted(prior.values(),key=lambda g:(g.get('date') or '',str(g['id'])),reverse=True)
 coverage={'archived_games':len(games),'boxscores_with_players':sum(bool(g.get('players')) for g in games),
           'first_game_date':min((g.get('date') for g in games if g.get('date')),default=None),
           'last_game_date':max((g.get('date') for g in games if g.get('date')),default=None)}
 if not coverage['boxscores_with_players']:raise SystemExit('No ESPN or NBA player boxes captured; leaving old file intact')
 result={'updated_at':now.isoformat(),'source':'Attribution per game; NBA.com official LiveData or ESPN completed-game box scores','games':games,'coverage':coverage}
 OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
 print('Captured',len([g for g in results if g]),'ESPN boxes; archive',coverage)
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Publish sourced NBL box scores and derived player leaders; no fabricated rows."""
import json,urllib.request,urllib.error,time,collections,datetime,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ledger=json.loads((ROOT/'data/nbl-research-current-ledger.json').read_text())['games']
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=22) as r:return json.load(r)
def normalize(s):return ''.join(c for c in str(s).lower() if c.isalnum())
known={normalize(t) for g in ledger for t in (g['home'],g['away'])}
games=[];fail=[]
headshot_cache={}
def verified_headshot(athlete):
 aid=str(athlete.get('id') or '')
 if not aid:return None
 if aid in headshot_cache:return headshot_cache[aid]
 photo=athlete.get('headshot')
 url=photo.get('href') if isinstance(photo,dict) else photo
 if not isinstance(url,str) or not url.startswith('https://'):
  headshot_cache[aid]=None
  return None
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'image/*'})
  with urllib.request.urlopen(req,timeout=5) as r:
   value=url if r.status==200 and r.headers.get('Content-Type','').startswith('image/') else None
 except (urllib.error.URLError,TimeoutError,ValueError):
  value=None
 headshot_cache[aid]=value
 return value

for i,g in enumerate(ledger):
 try:
  raw=get('https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/summary?event='+str(g['id']))
  box=raw.get('boxscore',{})
  groups=box.get('players',[])
  comps=raw.get('header',{}).get('competitions',[{}])[0].get('competitors',[])
  names={str(c.get('team',{}).get('id')):c.get('team',{}).get('displayName') for c in comps}
  teams=[]
  for group in groups:
   name=group.get('team',{}).get('displayName') or names.get(str(group.get('team',{}).get('id')))
   if not name:continue
   stats=[]
   for bucket in group.get('statistics',[]):
    keys=bucket.get('keys',[]);labels=bucket.get('labels',[])
    for player in bucket.get('athletes',[]):
     a=player.get('athlete',{});vals=player.get('stats') or []
     if not a.get('displayName') or not vals:continue
     stats.append({'id':str(a.get('id') or ''),'name':a['displayName'],'headshot':verified_headshot(a),'starter':bool(player.get('starter')), 'stats':dict(zip(keys or labels,vals)),'raw':vals,'labels':labels})
   teams.append({'team':name,'players':stats})
  if len(teams)<2 or not all(t['players'] for t in teams):raise ValueError('Incomplete player box score')
  games.append({'id':str(g['id']),'date':g['played_at'],'home':g['home'],'away':g['away'],'home_score':g['home_score'],'away_score':g['away_score'],'source_url':g.get('source_url'),'teams':teams})
 except Exception as e:fail.append({'id':str(g['id']),'reason':str(e)[:150]})
 if i%10==0:print('processed',i+1,'/',len(ledger),flush=True)
out={'season':'2026-27','updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'ESPN NBL game-summary player statistics','games_expected':len(ledger),'games_with_player_boxes':len(games),'games':games,'unavailable':fail}
dest=ROOT/'data/nbl-player-boxscores.json';dest.write_text(json.dumps(out,separators=(',',':'))+'\n')
print('NBL player boxes',len(games),'of',len(ledger),'failed',len(fail),'verified portraits',sum(bool(v) for v in headshot_cache.values()),flush=True)

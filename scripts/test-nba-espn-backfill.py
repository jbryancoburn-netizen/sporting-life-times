#!/usr/bin/env python3
"""Offline regression fixture for the independent ESPN player-box fallback."""
import importlib.util
from pathlib import Path
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('nba_espn_backfill',root/'backfill-nba-espn.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
game={'id':'123456789','date':'2026-10-22T23:00:00Z','competitions':[{'competitors':[
 {'homeAway':'home','score':'106','team':{'abbreviation':'NY','displayName':'New York Knicks'}},
 {'homeAway':'away','score':'101','team':{'abbreviation':'BOS','displayName':'Boston Celtics'}}]}]}
def player(pid,name,pts,fg):
 return {'athlete':{'id':pid,'displayName':name},'stats':['32',fg,'2-4','3-3','8','7','3','2','1',str(pts)]}
def entry(team,athletes):
 return {'team':{'abbreviation':team},'statistics':[{'labels':['MIN','FG','3PT','FT','REB','AST','STL','BLK','TO','PTS'],'athletes':athletes}]}
summary={'boxscore':{'players':[entry('BOS',[player('1','Fixture Player A',21,'8-12')]),entry('NY',[player('2','Fixture Player B',19,'7-11')])]}}
r=module.parse_summary(game,summary)
assert r and len(r['players'])==2,r
assert r['teams'][1]['code']=='NYK'
p=r['players'][0]
assert p['pts']==21 and p['reb']==8 and p['ast']==7 and p['fgm']==8 and p['fga']==12,p
assert r['leaders'][0]['name']=='Fixture Player A'
assert module.parse_summary(game,{'boxscore':{'players':[]}}) is None
print('PASS: ESPN completed-game box score fallback and empty-feed rejection')

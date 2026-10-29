#!/usr/bin/env python3
"""Replace malformed opponent labels using freshly saved official game evidence."""
import json,re,collections,importlib.util
from pathlib import Path
sp=importlib.util.spec_from_file_location('official_fields',Path(__file__).with_name('mbb_complete_official_fields.py'))
m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
changes=[]
for team in m.TEAMS:
 tid=str(team['espn_id']);p=m.DATA/'mbb-schedules-2026-27'/(tid+'.json');d=json.loads(p.read_text())
 own_names={m.norm(team['name']),m.norm(team.get('espn_name'))};removed=[];keep=[]
 for e in d.get('events',[]):
  ps=e['competitions'][0]['competitors'];own=next((x for x in ps if str(x.get('team',{}).get('id'))==tid),None);other=next((x for x in ps if x is not own),{})
  opponent=other.get('team',{});name=opponent.get('displayName','')
  reason=''
  if str(opponent.get('id'))==tid or m.norm(name) in own_names:reason='school incorrectly listed as its own opponent'
  elif m.norm(name) in {'mensbasketball','basketball'}:reason='sport heading imported as an opponent'
  elif e.get('id','').startswith('official-') and re.search(r'\b(?:NCAA|NIT|CBI|final|championship|tournament)\b',e.get('name',''),re.I):reason='conditional postseason slot is not a confirmed opponent'
  if reason:removed.append({'id':e.get('id'),'date':e.get('date'),'name':e.get('name'),'reason':reason})
  else:keep.append(e)
 if not removed:continue
 evidence=m.DATA/'mbb-official-game-evidence'/(tid+'.json')
 if not evidence.exists():continue
 facts=json.loads(evidence.read_text());d['events']=keep
 added=m.add_missing_games(d,team,facts['rows'],facts['source_url'])
 p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
 changes.append({'school':team['name'],'id':tid,'removed':removed,'named_fixtures_added':added,'source_url':facts['source_url']})
report={'schools':changes,'summary':{'schools_repaired':len(changes),'malformed_records_removed':sum(len(x['removed']) for x in changes),'official_named_games_added':sum(x['named_fixtures_added'] for x in changes)}}
(m.DATA/'mbb-placeholder-fixture-repair.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary']))

#!/usr/bin/env python3
import importlib.util
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('enrich',root/'scripts/enrich-nba-game-details.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
game={'teams':[{'home_away':'away','code':'CHI','score':105},{'home_away':'home','code':'BOS','score':111}]}
summary={'header':{'competitions':[{'competitors':[{'homeAway':'away','linescores':[{'value':25},{'value':26},{'value':28},{'value':26}]},{'homeAway':'home','linescores':[{'value':28},{'value':25},{'value':30},{'value':28}]}]}]},'boxscore':{'teams':[{'team':{'abbreviation':'CHI'},'statistics':[{'name':'fieldGoalPct','displayValue':'47.3'},{'name':'totalRebounds','displayValue':'46'}]},{'team':{'abbreviation':'BOS'},'statistics':[{'name':'fieldGoalPct','displayValue':'52.7'},{'name':'totalRebounds','displayValue':'48'}]}]}}
p=mod.periods(summary,game)
assert p=={'away':[25,26,28,26],'home':[28,25,30,28]},p
stats=mod.team_comparison(summary,game)
assert stats['away']['FG%']==47.3 and stats['home']['REB']==48,stats
bad={'teams':[dict(t) for t in game['teams']]}
bad['teams'][0]['score']=106
assert mod.periods(summary,bad) is None,'Unverified inconsistent quarters should not publish'
assert mod.team_comparison({'boxscore':{'teams':[]}},game) is None
print('PASS: verified quarter totals, numeric stats, empty-feed and mismatch rejection')

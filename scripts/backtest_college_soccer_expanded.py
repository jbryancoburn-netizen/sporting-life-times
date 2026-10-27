#!/usr/bin/env python3
"""Preliminary 2023/24 validation and untouched 2025 holdout, 336 configurations."""
import json, math, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
H=ROOT/'data'/'college-soccer-history'
years={}
for year in (2023,2024,2025):
 d=json.loads((H/f'men-d1-{year}.json').read_text())
 if d.get('errors') or len(d['games'])<100 or len(set(g['game_id'] for g in d['games']))!=len(d['games']):
  raise ValueError(f'Invalid {year} history')
 years[year]=sorted(d['games'],key=lambda g:(g['date'],g['game_id']))
def run(k,home,retention,margin):
 ratings={};scores={}
 for year in (2023,2024,2025):
  if year>2023:ratings={team:1500+(rating-1500)*retention for team,rating in ratings.items()}
  errors=[]
  for g in years[year]:
   a,b=g['home'],g['away'];ra=ratings.get(a,1500);rb=ratings.get(b,1500)
   p=1/(1+10**(-(ra+home-rb)/400))
   outcome=1 if g['home_goals']>g['away_goals'] else 0 if g['home_goals']<g['away_goals'] else .5
   errors.append((p-outcome)**2)
   delta=k*(outcome-p)*(max(1,math.log1p(abs(g['home_goals']-g['away_goals']))) if margin else 1)
   ratings[a]=ra+delta;ratings[b]=rb-delta
  scores[year]=sum(errors)/len(errors)
 return scores
configs=[]
for k in (8,12,20,28,36,48,64):
 for home in (0,35,55,75,100,125):
  for retention in (0,.5,.75,1):
   for margin in (False,True):
    result=run(k,home,retention,margin)
    configs.append(dict(k=k,h=home,reg=retention,margin=margin,validation=result[2024],holdout=result[2025]))
configs.sort(key=lambda c:(c['validation'],c['k'],c['h'],c['reg'],c['margin']))
best=configs[0]
result=dict(status='preliminary',method='2023 rating warmup; 2024 model selection; 2025 holdout',games_by_year={str(y):len(g) for y,g in years.items()},candidates_tested=len(configs),selected=best,holdout_comparators=dict(neutral_50_50=run(0,0,1,False)[2025],listed_home_only=run(0,best['h'],1,False)[2025]),top_validation_candidates=configs[:10],limitations=['Partial early-season coverage','All-conf may include non-D1 opponents','Actual venues unverified','Draws scored as half-results, not three-way forecasts'],live_elo_modified=False)
(H/'elo-backtest-expanded-preliminary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

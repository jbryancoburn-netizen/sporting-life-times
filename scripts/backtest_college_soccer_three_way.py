#!/usr/bin/env python3
"""Leakage-free three-way men's soccer forecast: 2023 warmup, 2024 tune, 2025 holdout."""
import json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT/'data'/'college-soccer-history'
years={}
for year in (2023,2024,2025):
 d=json.loads((BASE/f'men-d1-{year}.json').read_text())
 if not d.get('coverage_complete') or len(d.get('checked_dates',[]))!=153 or d.get('errors'):
  raise ValueError(f'Incomplete {year} history')
 years[year]=sorted(d['games'],key=lambda g:(g['date'],g['game_id']))
# Elo parameters selected using 2024 only; keep fixed for 2025 evaluation.
K,HOME,RETENTION=36,55,1
ratings={};fixtures={}
for year in (2023,2024,2025):
 if year>2023:ratings={t:1500+(v-1500)*RETENTION for t,v in ratings.items()}
 fixtures[year]=[]
 for g in years[year]:
  a,b=g['home'],g['away'];ra=ratings.get(a,1500);rb=ratings.get(b,1500)
  diff=ra+HOME-rb
  actual=0 if g['home_goals']>g['away_goals'] else 2 if g['home_goals']<g['away_goals'] else 1
  fixtures[year].append((diff,actual))
  p=1/(1+10**(-diff/400));outcome=(1,.5,0)[actual]
  delta=K*(outcome-p)*max(1,math.log1p(abs(g['home_goals']-g['away_goals'])))
  ratings[a]=ra+delta;ratings[b]=rb-delta
def probs(diff,base,scale):
 draw=min(.8,max(.005,base*math.exp(-abs(diff)/scale)))
 win=1/(1+10**(-diff/400))
 return ((1-draw)*win,draw,(1-draw)*(1-win))
def metrics(data,fn):
 brier=logloss=0
 for diff,actual in data:
  pr=fn(diff);brier+=sum((pr[i]-(i==actual))**2 for i in range(3))/3
  logloss-=math.log(max(1e-12,pr[actual]))
 n=len(data)
 return {'games':n,'multiclass_brier':brier/n,'log_loss':logloss/n}
candidates=[]
for base in (.15,.2,.25,.3,.35,.4,.45):
 for scale in (100,200,300,450,650,900,1500,1000000):
  score=metrics(fixtures[2024],lambda d:probs(d,base,scale))
  candidates.append({'draw_base':base,'draw_decay_elo':scale,'validation':score})
candidates.sort(key=lambda c:(c['validation']['log_loss'],c['validation']['multiclass_brier']))
best=candidates[0]
fn=lambda d:probs(d,best['draw_base'],best['draw_decay_elo'])
freq=[sum(actual==i for _,actual in fixtures[2024])/len(fixtures[2024]) for i in range(3)]
holdout=metrics(fixtures[2025],fn)
baseline=metrics(fixtures[2025],lambda d:tuple(freq))
flat=metrics(fixtures[2025],lambda d:probs(d,freq[1],1000000))
result={'status':'evaluated_not_deployed','method':'Pre-game sequential Elo; tune three-way draw shape on 2024 only; untouched 2025 holdout','games_by_year':{str(y):len(fixtures[y]) for y in years},'elo_parameters':{'k':K,'listed_home_elo':HOME,'offseason_retention':RETENTION},'selected':best,'holdout':holdout,'holdout_baseline_2024_outcome_frequencies':baseline,'holdout_constant_draw_elo':flat,'validation_outcome_frequencies':dict(zip(('home','draw','away'),freq)),'candidates_tested':len(candidates),'limitations':['Listed home is not verified actual home venue','Historical cohort includes unverified non-D1 opponents','Predictions are three-way probabilities, not calibrated goal-score forecasts','2025 holdout is not used for selection'],'live_elo_modified':False}
(BASE/'elo-three-way-backtest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

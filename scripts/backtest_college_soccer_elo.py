#!/usr/bin/env python3
"""Leakage-free NCAA men's D-I soccer Elo backtest. No holdout fitting."""
import json,math,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
H=ROOT/'data'/'college-soccer-history'
OUT=ROOT/'data'/'college-soccer-history'/'elo-backtest.json'
def load(y,allow_partial=False):
 p=H/f'men-d1-{y}.json'
 if not p.exists():raise ValueError(f'Missing {p.name}')
 d=json.loads(p.read_text())
 if d.get('errors') or (not allow_partial and not d.get('coverage_complete')):raise ValueError(f'{y} historical coverage not certified')
 if not allow_partial and len(d.get('checked_dates',[]))!=153:raise ValueError(f'{y} incomplete date ledger')
 g=d['games']
 if len(g)<100 or len({x['game_id'] for x in g})!=len(g):raise ValueError(f'{y} missing or duplicate finals')
 for x in g:
  if x['date'][:4]!=str(y) or x['home']==x['away'] or min(x['home_goals'],x['away_goals'])<0:raise ValueError(f'{y} invalid match')
 return sorted(g,key=lambda x:(x['date'],x['game_id']))
def replay(games,k,home):
 ratings={};pred=[]
 for g in games:
  a,b=g['home'],g['away'];ra=ratings.get(a,1500);rb=ratings.get(b,1500)
  # Listed home team is not verified venue: estimate label advantage, not true home field.
  p=1/(1+10**(-(ra+home-rb)/400))
  actual=1 if g['home_goals']>g['away_goals'] else (0 if g['home_goals']<g['away_goals'] else .5)
  pred.append((g['date'],p,actual))
  margin=abs(g['home_goals']-g['away_goals'])
  delta=k*(actual-p)*max(1,math.log1p(margin))
  ratings[a]=ra+delta;ratings[b]=rb-delta
 return pred
def metrics(rows):
 return {'games':len(rows),'brier':round(sum((p-y)**2 for _,p,y in rows)/len(rows),6),'mae':round(sum(abs(p-y) for _,p,y in rows)/len(rows),6)}
def main():
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('--preliminary',action='store_true');args=ap.parse_args()
 train23=load(2023,args.preliminary);valid24=load(2024,args.preliminary);test=load(2025,args.preliminary)
 configs=[]
 for k in (12,20,28,36):
  for home in (0,35,55,75,100):
   rows=replay(train23+valid24,k,home)
   configs.append((metrics([x for x in rows if x[0][:4]=='2024'])['brier'],k,home))
 _,k,home=min(configs)
 rows=replay(sorted(train23+valid24+test,key=lambda x:(x['date'],x['game_id'])),k,home)
 holdout=[x for x in rows if x[0][:4]=='2025']
 result={'status':'preliminary' if args.preliminary else 'complete','training_years':[2023],'validation_year':2024,'holdout_year':2025,'selected_k':k,'selected_listed_home_elo':home,'holdout':metrics(holdout),'baseline_holdout':metrics([(d,.5,y) for d,p,y in holdout]),'warning':'Draws scored as half-outcomes; this is not a calibrated three-way win/draw/loss or goal-score forecast. Neutral venue remains unverified.'}
 if args.preliminary:
  result['limitations']='Partial season coverage; listed-home venue unverified; all-conf may include non-D1 opponents.'
  target=H/'elo-backtest-preliminary.json'
 else:target=OUT
 target.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__':
 try:main()
 except ValueError as e:print('NOT CERTIFIED:',e,file=sys.stderr);sys.exit(2)

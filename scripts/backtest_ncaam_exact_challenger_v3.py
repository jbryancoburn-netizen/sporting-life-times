#!/usr/bin/env python3
"""Same-game historical diagnostic of exact roster-v2 vs quality-v3 preseason adjustment rules.

Uses season-roster archives, which may have been updated after opening day.
A positive result is retrospective evidence, NOT as-of-preseason certification.
"""
import argparse,json,math,statistics
from pathlib import Path
from itertools import groupby
from backtest_ncaam_quality_retrospective import (
    read_gz,school_key,extract_games,preseason_features,
    unadjusted_end,logistic,update_date_batch
)
def replay(games,prior,features, challenger):
    good=[f for f in features.values() if f['covered']]
    mr=statistics.median(f['r'] for f in good)
    mt=statistics.median(f['t'] for f in good)
    mq=statistics.median(f['q'] for f in good)
    universe={t for g in games for t in (g['home'],g['away'])}
    elo={}
    for t in universe:
        v=1500+0.65*(prior.get(t,1500)-1500)
        f=features.get(t)
        if f and f['covered']:
            if challenger:
                v+=60*(f['r']-mr)+40*(f['t']-mt)+1200*(f['q']-mq)
            else:
                v+=120*(f['r']-mr)+160*(f['t']-mt)
        elo[t]=v
    losses=[]; briers=[]; ids=[]
    for day,it in groupby(games,key=lambda g:g['day']):
        batch=list(it)
        for g in batch:
            if (day-games[0]['day']).days >= 45: continue
            p=logistic(elo[g['home']]-elo[g['away']])
            y=float(g['home_score']>g['away_score'])
            losses.append(-y*math.log(max(p,1e-12))-(1-y)*math.log(max(1-p,1e-12)))
            briers.append((p-y)**2)
            ids.append(g['id'])
        update_date_batch(elo,batch)
    return {'games':len(ids),'log_loss':sum(losses)/len(losses),'brier':sum(briers)/len(briers)},ids

def main():
    a=argparse.ArgumentParser();a.add_argument('--source',type=Path,required=True)
    a.add_argument('--output',type=Path,required=True);args=a.parse_args()
    priors={}; games={}; feat={}; audit={}
    for y in (2023,2024,2025,2026):
        box=read_gz(args.source,'player_box',y)
        roster=read_gz(args.source,'team_rosters',y)
        sch=read_gz(args.source,'schedule',y)
        teams={}
        for r in box:
            key=school_key(r.get('team'));id_=str(r.get('team_ncaa_team_id') or '')
            if key and id_: teams.setdefault(key,id_)
        games[y],_=extract_games(sch,teams,box)
        if len(games[y])<2000:raise RuntimeError('insufficient historical games')
        priors[y]=unadjusted_end(games[y],priors.get(y-1,{}),teams)
        if y>=2024:
            feat[y],_,audit[str(y)]=preseason_features(roster,read_gz(args.source,'player_box',y-1))
    results={}
    for y in (2024,2025,2026):
        base,ids0=replay(games[y],priors[y-1],feat[y],False)
        new,ids1=replay(games[y],priors[y-1],feat[y],True)
        assert ids0==ids1 and len(ids0)==len(set(ids0))
        results[str(y)]={'incumbent':base,'challenger':new,'same_games':True}
    hold=results['2026']
    x=hold['incumbent'];y=hold['challenger']
    outcome={'test':'historical exact-formula roster-v2 versus player-quality-v3',
      'fixed_params':{'retention_incumbent':120,'transfer_incumbent':160,
                      'retention_challenger':60,'transfer_challenger':40,'quality_challenger':1200},
      'seasons':results,'holdout_season':2026,'holdout_games':x['games'],
      'log_loss_gain':x['log_loss']-y['log_loss'],'brier_gain':x['brier']-y['brier'],
      'challenger_wins_both':y['log_loss']<x['log_loss'] and y['brier']<x['brier'],
      'same_game_replay':True,
      'preopening_asof_certified':False,
      'production_policy':'Do not auto-promote without preopening source timing verification and live release checks'}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(outcome,indent=2)+'\n')
    print(json.dumps(outcome,indent=2))
if __name__=='__main__':main()

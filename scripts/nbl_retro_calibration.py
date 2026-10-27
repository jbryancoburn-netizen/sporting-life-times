#!/usr/bin/env python3
"""NBL RETRO rolling-origin calibration; fresh 1500 each season, no future leakage."""
import argparse,json,math
from pathlib import Path
from scripts.nbl_three_season_eval import games,START,TEAMS
HOME_GRID=(0,10,20,30,40,50,65,80,100)
STEP_GRID=(6,12,18,24,36)
def fit(past,home,step):
    ratings={t:1500. for t in TEAMS}; counts={t:0 for t in TEAMS}
    for g in past:
        counts[g['home']]+=1;counts[g['away']]+=1
    for _ in range(120):
        grad={t:0. for t in TEAMS}
        for g in past:
            h,a=g['home'],g['away']
            p=1/(1+10**((ratings[a]-ratings[h]-home)/400))
            v=(g['home_score']>g['away_score'])-p
            grad[h]+=v;grad[a]-=v
        change=0.
        for t in TEAMS:
            before=ratings[t]
            ratings[t]=max(1100,min(1900,before+step*(grad[t]-.006*(before-1500))/(3+counts[t])))
            change=max(change,abs(ratings[t]-before))
        if change<.0001:break
    return ratings
def predict(r,g,home):
    return 1/(1+10**((r[g['away']]-r[g['home']]-home)/400))
def score(season,home,step,min_history=12):
    total=0;loss=0.;brier=0.;correct=0
    days=sorted({g['played_at'][:10] for g in season})
    for day in days:
        past=[g for g in season if g['played_at'][:10]<day]
        if len(past)<min_history:continue
        ratings=fit(past,home,step)
        for g in season:
            if g['played_at'][:10]!=day:continue
            prob=max(1e-9,min(1-1e-9,predict(ratings,g,home)))
            result=int(g['home_score']>g['away_score'])
            loss-=math.log(prob if result else 1-prob)
            brier+=(prob-result)**2
            correct+=int((prob>=.5)==result)
            total+=1
    return {'n':total,'log_loss':round(loss/total,6) if total else None,'brier':round(brier/total,6) if total else None,'accuracy':round(correct/total,6) if total else None}
def main():
    a=argparse.ArgumentParser()
    a.add_argument('--s2024',required=True);a.add_argument('--s2025',required=True);a.add_argument('--s2026',required=True);a.add_argument('--output',required=True)
    arg=a.parse_args()
    seasons={name:games(getattr(arg,'s'+name[:4]),name)[0] for name in START}
    grid=[]
    for h in HOME_GRID:
        for step in STEP_GRID:
            result=score(seasons['2025-26'],h,step)
            grid.append({'home_advantage':h,'retro_step':step,**result})
    winner=min(grid,key=lambda x:(x['log_loss'],x['home_advantage'],x['retro_step']))
    chosen=score(seasons['2026-27'],winner['home_advantage'],winner['retro_step'])
    incumbent=score(seasons['2026-27'],65,18)
    coin=round(math.log(2),6)
    report={'method':'NBL RETRO full-network fitted only on games strictly before prediction day','status':'RESEARCH_UNCERTIFIED','season_start_elo':1500,'prior_season_carryover':False,'home_grid':HOME_GRID,'retro_step_grid':STEP_GRID,'retro_step_is_not_game_by_game_k':True,'selection_season':'2025-26','holdout_season':'2026-27','train_games':len(seasons['2025-26']),'holdout_games':len(seasons['2026-27']),'min_prior_games':12,'tested_models':len(grid),'best_validation':winner,'best_validation_holdout':chosen,'incumbent_home65_step18_holdout':incumbent,'coin_flip_log_loss':coin,'outperforms_coinflip_on_holdout':chosen['log_loss']<coin,'parameters_approved':False,'validation_grid':sorted(grid,key=lambda x:x['log_loss']),'limitations':['One complete validation season; held-out NBL27 sample small','Candidate provider finals not fully independently certified','Step is numerical solver strength, not traditional chronological Elo K','Selection must not use 2026-27 results']}
    Path(arg.output).write_text(json.dumps(report,indent=2)+'\n')
    print('NBL_RETRO_CALIBRATION_REPORT='+json.dumps({k:report[k] for k in ['tested_models','best_validation','best_validation_holdout','incumbent_home65_step18_holdout','coin_flip_log_loss','outperforms_coinflip_on_holdout']}))
if __name__=='__main__':main()

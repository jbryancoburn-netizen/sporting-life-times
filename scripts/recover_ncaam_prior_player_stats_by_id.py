#!/usr/bin/env python3
"""Recover missing historical minutes by pinned athlete ID, NEVER by name-only.

Only eligible if the prior NCAA player_id AND old team_id match the source
crosswalk, name agrees, and at least one valid 2025–26 player game box exists.
Keep results separate from published Elo pending full model recalibration.
"""
import argparse,csv,gzip,json,math,re
from collections import defaultdict,Counter
from pathlib import Path

def normalize(x):return ''.join(c for c in str(x or '').casefold() if c.isalnum())
def calculate(movement,crosswalk,previous_box):
    roster={}
    for team in movement['teams']:
        for p in team['players']:
            uid=str(p['current_id'])
            if uid in roster:raise ValueError('Duplicate current athlete ID')
            roster[uid]=(team,p)
    records=defaultdict(lambda:{'mins':0.,'pts':0.,'games':set(),'names':set(),'schools':set(),'invalid':0})
    input_count=0
    with gzip.open(previous_box,'rt',encoding='utf8',newline='') as f:
        for row in csv.DictReader(f):
            input_count+=1
            playerid=str(row.get('player_id') or '').strip()
            prior=str(row.get('team_ncaa_team_id') or '').strip()
            if not playerid or not prior:continue
            key=(playerid,'ncaa:'+prior)
            data=records[key]
            try:
                mins=float(row.get('mins') or 0)
                pts=float(row.get('pts') or 0)
            except (TypeError,ValueError):
                data['invalid']+=1;continue
            contest=str(row.get('contest_id') or '').strip()
            if not contest or contest in data['games'] or not (0<mins<=70 and 0<=pts<=100 and math.isfinite(mins) and math.isfinite(pts)):
                data['invalid']+=1;continue
            data['mins']+=mins;data['pts']+=pts
            data['games'].add(contest)
            data['names'].add(normalize(row.get('player')))
            data['schools'].add(str(row.get('team') or ''))
    output=[];status=Counter();ids=set()
    for link in crosswalk['links']:
        uid=str(link['id'])
        if uid in ids or uid not in roster:raise ValueError('Duplicate or unknown crosswalk athlete')
        ids.add(uid)
        team,cur=roster[uid]
        current_school=cur.get('prior_school_id')
        rawmin=cur.get('prior_minutes')
        prior_id=str(link['pid'])
        old_team=str(link['prior'])
        if link['method']=='jaro_winkler':
            status['fuzzy_link_not_eligible']+=1
            continue
        if old_team==current_school and isinstance(rawmin,(int,float)) and rawmin>0:
            status['already_counted']+=1
            continue
        data=records.get((prior_id,old_team))
        if data is None:
            status['prior_player_id_and_school_no_box']+=1
            continue
        if normalize(cur['player']) not in data['names'] or len(data['names'])!=1:
            status['old_player_id_name_collision']+=1
            continue
        if data['invalid']:
            status['historical_box_has_invalid_or_duplicate_game_rows']+=1
            continue
        if len(data['games'])<1 or data['mins']<=0:
            status['no_valid_historical_minutes']+=1
            continue
        output.append({'current_espn_id':uid,'player':cur['player'],
                       'current_team':team['team'],'current_team_id':team['team_id'],
                       'historical_ncaa_player_id':prior_id,'historical_team_id':old_team,
                       'historical_team_names':sorted(data['schools']),
                       'verified_2025_26_minutes':round(data['mins'],3),
                       'verified_2025_26_points':round(data['pts'],3),
                       'verified_2025_26_games':len(data['games']),
                       'old_name_only_team_conflict':old_team!=current_school,
                       'source_link_method':link['method'],
                       'eligibility':'requires_independent_model_rebuild_not_automatically_counted'})
        status['recovered_by_prior_id_and_team_with_name_check']+=1
    if len(ids)!=3523:raise ValueError('Incomplete crosswalk')
    if status['already_counted']!=2923:
        raise ValueError('Previously verified player count unexpectedly changed')
    output.sort(key=lambda x:(-x['verified_2025_26_minutes'],x['current_team'],x['player']))
    return {'season':'2026-27','status':'ID_GROUNDED_HISTORICAL_RECONCILIATION_SHADOW',
            'historical_box_rows_examined':input_count,'original_measured_players':2923,
            'source_linked_players':3523,'source_unmeasured_links':600,
            'source_result_counts':dict(status),'recovered_eligible_for_future_review':len(output),
            'changes_to_published_elo':False,'automatically_promoted':False,
            'source':'2025-26 NCAA-origin season player-game boxes matched to pinned NCAA player_id and old team_id; current ESPN link',
            'warning':'Do not credit historical production until full roster-model recalculation and source approval. Missing/invalid records remain excluded.',
            'verified_historical_id_recoveries':output}
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--data',type=Path,default=Path('data'))
    p.add_argument('--player-box',type=Path,required=True)
    p.add_argument('--out',type=Path,default=Path('data/ncaam-2026-27-id-history-recoveries.json'))
    a=p.parse_args()
    inputs=[json.loads((a.data/n).read_text()) for n in
        ('ncaam-2026-27-player-movement-audit.json','ncaam-2026-27-direct-player-crosswalk.json')]
    report=calculate(*inputs,a.player_box)
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('status','source_result_counts','recovered_eligible_for_future_review','changes_to_published_elo')},indent=2))
if __name__=='__main__':main()

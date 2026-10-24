#!/usr/bin/env python3
"""NCAA 2024/2025-train, 2026-test player-quality retrospective experiment.

IMPORTANT: historical rosters were compiled after their seasons. This is
not a verified as-of-preseason study and can NEVER promote a production model.
Season-specific player/team IDs are NOT reused across seasons. Cross-season
player links use only unique exact normalized full names; ambiguous excluded.
"""
import argparse,csv,gzip,hashlib,json,math,statistics
from collections import defaultdict,Counter
from itertools import groupby
from datetime import datetime,timedelta
from pathlib import Path

K=24.0
MOV=0.55
CARRYOVER=0.65
BETA_RET=120.0
BETA_TRANSFER=160.0
BETA_GRID=(-1000,-600,-400,-200,-100,0,100,200,300,400,600,800,1000,1200,1600,2000)
SCHOOL_ALIASES={'iupui':'iu indy','fairleigh dickinson':'fdu',
                'tex a&m-commerce':'east texas a&m',
                'saint francis (pa)':'saint francis'}
def school_key(name):
    value=' '.join(str(name or '').strip().lower().split())
    return SCHOOL_ALIASES.get(value,value)
def player_key(name):
    return ''.join(c for c in str(name or '').upper() if c.isalnum())
def read_gz(root,kind,year):
    path=Path(root)/f'ncaa_mbb_{kind}_{year}.csv.gz'
    with gzip.open(path,'rt',encoding='utf8',newline='') as f:
        rows=list(csv.DictReader(f))
    if not rows:raise ValueError(f'empty {path}')
    return rows
def number(x):
    try:
        v=float(x)
        return v if math.isfinite(v) else 0.0
    except (TypeError,ValueError):return 0.0
def game_day(s):
    for fmt in ('%m/%d/%Y','%Y-%m-%d'):
        try:return datetime.strptime(str(s),fmt).date()
        except ValueError:pass
    raise ValueError('unknown game date: '+str(s))
def logistic(diff):
    return 1/(1+10**(-diff/400))
def game_update(ratings,g):
    h,a,hs,aws=g['home'],g['away'],g['home_score'],g['away_score']
    p=logistic(ratings[h]-ratings[a])
    mult=1+MOV*math.log1p(abs(hs-aws))/math.log(10)
    shift=K*mult*((1.0 if hs>aws else 0.0)-p)
    ratings[h]+=shift
    ratings[a]-=shift
    return p
def update_date_batch(ratings, games):
    """Score every game from the same pre-date Elo; apply net changes together."""
    changes=defaultdict(float)
    for g in games:
        h,a=g['home'],g['away']
        if h not in ratings or a not in ratings:continue
        prob=logistic(ratings[h]-ratings[a])
        margin=abs(g['home_score']-g['away_score'])
        multiplier=1+MOV*math.log1p(margin)/math.log(10)
        delta=K*multiplier*((1.0 if g['home_score']>g['away_score'] else 0.0)-prob)
        changes[h]+=delta
        changes[a]-=delta
    for team,change in changes.items():
        ratings[team]+=change

def extract_games(schedules,programs,boxes):
    ids=defaultdict(lambda:defaultdict(set))
    for r in boxes:
        cid=str(r.get('contest_id') or '')
        home_id=str(r.get('home_ncaa_team_id') or '')
        away_id=str(r.get('away_ncaa_team_id') or '')
        if cid and home_id:ids[cid]['home'].add(home_id)
        if cid and away_id:ids[cid]['away'].add(away_id)
    out=[];excluded=Counter();seen=set()
    for r in schedules:
        cid=str(r.get('contest_id') or '')
        if not cid or cid in seen:
            excluded['duplicate_or_missing_contest_id']+=1
            continue
        seen.add(cid)
        home,away=school_key(r.get('home')),school_key(r.get('away'))
        if home not in programs or away not in programs or home==away:
            excluded['outside_roster_teams']+=1
            continue
        hs,aws=number(r.get('home_score')),number(r.get('away_score'))
        if hs<1 or aws<1 or hs==aws:
            excluded['nonfinal_or_invalid_score']+=1
            continue
        if cid not in ids or not ids[cid]['home'] or not ids[cid]['away']:
            excluded['no_ncaa_game_identifiers']+=1
            continue
        if len(ids[cid]['home'])!=1 or len(ids[cid]['away'])!=1:
            excluded['ambiguous_ncaa_game_identifiers']+=1
            continue
        if programs[home]!=next(iter(ids[cid]['home'])) or programs[away]!=next(iter(ids[cid]['away'])):
            excluded['ncaa_team_identifier_mismatch']+=1
            continue
        out.append(dict(id=cid,day=game_day(r['game_date']),home=home,away=away,
                        home_score=hs,away_score=aws))
    out.sort(key=lambda x:(x['day'],x['id']))
    return out,dict(excluded)
def collect_prior_stats(rows):
    by_person=defaultdict(lambda:defaultdict(lambda:{'minutes':0.0,'points':0.0,'games':set()}))
    team_minutes=defaultdict(float)
    seen=set();errors=Counter();all_points=0.0
    for p in rows:
        tid=str(p.get('team_ncaa_team_id') or '')
        school=school_key(p.get('team'))
        name=player_key(p.get('player'))
        cid=str(p.get('contest_id') or '')
        minutes,pts=number(p.get('mins')),number(p.get('pts'))
        if not name or not school or not tid or not cid or minutes<=0 or minutes>70 or pts<0 or pts>100:
            errors['incomplete_or_invalid_box']+=1
            continue
        key=(cid,tid,name)
        if key in seen:
            errors['duplicate_player_game_row']+=1
            continue
        seen.add(key)
        slot=by_person[name][school]
        slot['minutes']+=minutes
        slot['points']+=pts
        slot['games'].add(cid)
        team_minutes[school]+=minutes
        all_points+=pts
    totals={};ambiguous=0
    for name,schools in by_person.items():
        if len(schools)>1:
            ambiguous+=1
            continue
        school=next(iter(schools))
        r=schools[school]
        totals[name]=(school,r['minutes'],r['points'],len(r['games']))
    total_mins=sum(team_minutes.values())
    return totals,team_minutes,all_points/max(1.0,total_mins),dict(errors),ambiguous
def preseason_features(current_roster,previous_box):
    previous,denom,mean_rate,prior_errors,ambiguous=collect_prior_stats(previous_box)
    current=defaultdict(list);schools={};ids_seen=set();dup_ids=0
    for r in current_roster:
        school=school_key(r['team']);id_=str(r.get('team_id') or r.get('team_ncaa_team_id') or '')
        if id_ and school in schools and schools[school] and schools[school]!=id_:
            raise ValueError('one name maps to two current-team IDs')
        schools[school]=id_
        key=player_key(r.get('player'))
        if not key:continue
        player_id=(school,key)
        if player_id in ids_seen:
            dup_ids+=1
            continue
        ids_seen.add(player_id)
        current[school].append(key)
    by_school={};found=ret=trans=0
    for school,athletes in current.items():
        den=denom.get(school,0.0)
        stats={'ret':0.0,'trans':0.0,'points':0.0,'quality_residual':0.0}
        for p in athletes:
            prior=previous.get(p)
            if prior is None:continue
            prior_school,minutes,points,n=prior
            found+=1
            seg='ret' if school==prior_school else 'trans'
            stats[seg]+=minutes
            stats['points']+=points
            stats['quality_residual']+=points-mean_rate*minutes
            if seg=='ret':ret+=1
            else:trans+=1
        if den<1000 or len(athletes)<8:
            by_school[school]={'r':0.0,'t':0.0,'q':0.0,'covered':False}
        else:
            by_school[school]={'r':min(1.0,stats['ret']/den),
                               't':min(1.5,stats['trans']/den),
                               'q':stats['quality_residual']/den,'covered':True}
    covered=[x for x in by_school.values() if x['covered']]
    if not covered:raise ValueError('no prior minute features')
    med=lambda k:statistics.median(x[k] for x in covered)
    mr,mt,mq=med('r'),med('t'),med('q')
    for school,s in by_school.items():
        s['minute_adj']=(BETA_RET*(s['r']-mr)+BETA_TRANSFER*(s['t']-mt)) if s['covered'] else 0.0
        s['q_centered']=s['q']-mq if s['covered'] else 0.0
    audit={'roster_teams':len(schools),'covered_teams':len(covered),
           'current_roster_players':sum(len(x) for x in current.values()),
           'unique_exact_prior_name_matches':found,'returner_prior_name_matches':ret,
           'transfer_prior_name_matches':trans,
           'unmatched_current_roster_players':sum(len(x) for x in current.values())-found,
           'ambiguous_prior_season_names_excluded':ambiguous,
           'roster_duplicates_excluded':dup_ids,'prior_box_warnings':prior_errors,
           'league_prior_points_per_minute':round(mean_rate,6),
           'median_retention':round(mr,6),'median_transfer':round(mt,6),
           'median_quality_residual':round(mq,6)}
    return by_school,schools,audit
def season_prediction(games,prior_elo,features,quality_beta,first_days=45):
    present=set(features)
    init={t:1500+CARRYOVER*(prior_elo.get(t,1500)-1500)+features[t]['minute_adj']+
          quality_beta*features[t]['q_centered'] for t in present}
    ratings=init.copy()
    if not games:raise ValueError('no historical D1 games')
    beginning=games[0]['day'];end=beginning+timedelta(days=first_days)
    ll=brier=0.0;n=0
    # We have dates, not verified tipoff timestamps. Every matchup on a date
    # must be predicted from the same pre-date ratings snapshot.
    for day, matches_iter in groupby(games,key=lambda g:g['day']):
        matches=list(matches_iter)
        if day<end:
            for g in matches:
                if g['home'] not in ratings or g['away'] not in ratings:continue
                p=logistic(ratings[g['home']]-ratings[g['away']])
                y=1.0 if g['home_score']>g['away_score'] else 0.0
                ll-=y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12))
                brier+=(p-y)**2
                n+=1
        update_date_batch(ratings,matches)
    if n<100:raise ValueError(f'insufficient first {first_days} days games: {n}')
    return {'games':n,'log_loss':ll/n,'brier':brier/n}
def unadjusted_end(games,prior_elo,programs):
    ratings={t:1500+CARRYOVER*(prior_elo.get(t,1500)-1500) for t in programs}
    for day,matches in groupby(games,key=lambda g:g['day']):
        update_date_batch(ratings,list(matches))
    return ratings
def evaluate(root):
    source=Path(root);years=(2023,2024,2025,2026)
    rosters={y:read_gz(source,'team_rosters',y) for y in years}
    boxes={y:read_gz(source,'player_box',y) for y in years}
    schedule={y:read_gz(source,'schedule',y) for y in years}
    # Rosters have no guaranteed team_id; use box-proven NCAA program identifiers.
    programs={}
    for y in years:
        mapping=defaultdict(set)
        for row in boxes[y]:
            team=school_key(row.get('team'))
            tid=str(row.get('team_ncaa_team_id') or '').strip()
            if team and tid:mapping[team].add(tid)
        programs[y]={team:next(iter(ids)) for team,ids in mapping.items() if len(ids)==1}
        if len(programs[y])<300:
            raise ValueError(f'Too few verified NCAA school IDs from box: {y} {len(programs[y])}')

    games={};discard={};ratings={};feature={};feature_audit={}
    for y in years:
        games[y],discard[y]=extract_games(schedule[y],programs[y],boxes[y])
        ratings[y]=unadjusted_end(games[y],ratings.get(y-1,{}),programs[y])
        if y>2023:feature[y],_,feature_audit[y]=preseason_features(rosters[y],boxes[y-1])
    for y in years[1:]:
        if not max(g['day'] for g in games[y-1])<min(g['day'] for g in games[y]):
            raise ValueError('Prior-season results leak into later prediction period')
    def aggregate(yset,beta):
        per={y:season_prediction(games[y],ratings[y-1],feature[y],beta) for y in yset}
        n=sum(s['games'] for s in per.values())
        return {'games':n,'log_loss':sum(s['log_loss']*s['games'] for s in per.values())/n,
                'brier':sum(s['brier']*s['games'] for s in per.values())/n,
                'per_season':per}
    trained=[(b,aggregate((2024,2025),b)) for b in BETA_GRID]
    best=min(trained,key=lambda it:(it[1]['log_loss'],abs(it[0])))[0]
    hold_baseline=aggregate((2026,),0)
    hold_quality=aggregate((2026,),best)
    before=aggregate((2024,2025),0)
    trainbest=aggregate((2024,2025),best)
    manifest={str(y):{kind:hashlib.sha256((source/f'ncaa_mbb_{kind}_{y}.csv.gz').read_bytes()).hexdigest()
                      for kind in ('team_rosters','player_box','schedule')} for y in years}
    return {
        'experiment':'ncaam-retrospective-scoring-quality-over-minute-elo-v1',
        'status':'RETROSPECTIVE_DIAGNOSTIC_NOT_ASOF_PRESEASON_VALIDATED',
        'production_approval':False,
        'train_seasons':[2024,2025],'untouched_holdout_season':2026,
        'first_days_per_season':45,
        'features':{'baseline':'independent prior-year Elo plus 120*(returning share minus median) and 160*(incoming share minus median)',
                    'quality':'weighted 2023/24/25 prior-year player scoring residual per minute, source-unique exact names only',
                    'quality_grid':list(BETA_GRID),'selected_quality_beta':best,
                    'prior_elo_source':'independent replay of NCAA actual scores without third-party ratings',
                    'game_venue':'neutral (unverified true-home/neutral venue)'},
        'training_minutes_only':before,
        'training_minutes_plus_quality':trainbest,
        'holdout_minutes_only':hold_baseline,
        'holdout_minutes_plus_quality':hold_quality,
        'holdout_log_loss_gain':hold_baseline['log_loss']-hold_quality['log_loss'],
        'holdout_brier_gain':hold_baseline['brier']-hold_quality['brier'],
        'training_grid_boundary':best in (min(BETA_GRID),max(BETA_GRID)),
        'holdout_both_metrics_improved':hold_quality['log_loss']<hold_baseline['log_loss'] and
                                        hold_quality['brier']<hold_baseline['brier'] and best!=0,
        'roster_audit':feature_audit,
        'game_counts':{str(y):{'usable_d1':len(games[y]),'excluded':discard[y]} for y in years},
        'source_hashes':manifest,
        'limitations':['Historical team-rosters source appears to be retrospectively compiled, not time-stamped preseason snapshots',
                       'Therefore current-season roster membership could incorporate games or transfers learned after opening day',
                       'Player IDs are season-specific; matches are unique exact names, not cross-season IDs',
                       'Venue is treated as neutral for both incumbent and candidate',
                       'Matchup population restricted to reported NCAA team ID concordance; missing data excluded',
                       'No outcome was used to choose the quality coefficient from untouched 2026 games'],
        'release_decision':'Remain provisional, do not promote new player-quality coefficient until legitimate as-of preseason historical roster captures exist.'}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    result=evaluate(args.source)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,default=str)+'\n',encoding='utf8')
    print(json.dumps({k:result[k] for k in ['status','features','training_minutes_only','training_minutes_plus_quality',
        'holdout_minutes_only','holdout_minutes_plus_quality','holdout_both_metrics_improved']},indent=2))
if __name__=='__main__':main()

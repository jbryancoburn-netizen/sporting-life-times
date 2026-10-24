"""Publish v2 research forecasts from pinned sufficient goal statistics.

Every match uses only previous calendar days for ratings and goal rates.
Original v1 forecasts are never read for modification or overwritten.
"""
import copy,datetime as dt,math,json,argparse
from pathlib import Path
from collections import defaultdict
from college_soccer_fixture_source import candidate,fetch_scoreboards_with_audit,now_utc,ET
from update_college_soccer_elo import atomic_json,read_json,HERE

MODEL='ncaa_matchup_draw_v2'

def logit(p):
    if not math.isfinite(p) or not 0<p<1:raise ValueError('invalid probability')
    return math.log(p/(1-p))

def poisson_draw(h,a):
    if not all(math.isfinite(x) and 0<x<=5 for x in (h,a)):raise ValueError('invalid goal rate')
    # Full diagonal; 80 terms makes the omitted mass negligible for rates <=5.
    term=math.exp(-h-a);total=term
    for k in range(1,80):term*=h*a/(k*k);total+=term
    return total

def predict(p,h,a,coef):
    raw=poisson_draw(h,a)
    z=coef[0]+coef[1]*logit(raw)+coef[2]*abs(logit(p))
    d=1/(1+math.exp(-max(-700,min(700,z))))
    return {'p_home':(1-d)*p,'p_draw':d,'p_away':(1-d)*(1-p),'raw_poisson_draw':raw}

def rates(state,home,away):
    n=state['matches']
    if n<=0:raise ValueError('missing goal history')
    hmean=max(.2,state['home_goals']/n);amean=max(.2,state['away_goals']/n)
    h=state['teams'].get(home,{});a=state['teams'].get(away,{})
    hat=(h.get('home_gf',0)+8*hmean)/(h.get('home_n',0)+8)/hmean
    hdef=(h.get('home_ga',0)+8*amean)/(h.get('home_n',0)+8)/amean
    aat=(a.get('away_gf',0)+8*amean)/(a.get('away_n',0)+8)/amean
    adef=(a.get('away_ga',0)+8*hmean)/(a.get('away_n',0)+8)/hmean
    return max(.15,min(5,hmean*hat*adef)),max(.15,min(5,amean*aat*hdef))

def prior_state(bundle,finals,day):
    shadow=bundle['shadow'];cfg=shadow['params']
    ratings={k:{r['team_id']:r['elo'] for r in rows} for k,rows in shadow['cohorts'].items()}
    identities={(key.split('-d')[0],tid):key for key,rows in ratings.items() for tid in rows}
    goals=copy.deepcopy(bundle['goals']);seen=set();dates=defaultdict(list)
    for g in finals:
        if g['match_id'] in seen:raise ValueError('duplicate verified final')
        seen.add(g['match_id'])
        if g['date']>=day:continue
        key=identities.get((g['gender'],g['home_team']))
        if key is None or identities.get((g['gender'],g['away_team']))!=key:continue
        if g['date']>bundle['goal_as_of']:
            c=goals[key];c['matches']+=1;c['home_goals']+=g['home_goals'];c['away_goals']+=g['away_goals']
            for side in ('home','away'):
                t=c['teams'].setdefault(g[side+'_team'],{})
                for field,value in [('n',1),('gf',g[side+'_goals']),('ga',g[('away' if side=='home' else 'home')+'_goals'])]:
                    t[side+'_'+field]=t.get(side+'_'+field,0)+value
        if g['date']>shadow['as_of']:dates[g['date'],key].append(g)
    for (_,key),games in sorted(dates.items()):
        delta=defaultdict(float);c=cfg[key];frozen=ratings[key]
        for g in games:
            h,a=g['home_team'],g['away_team']
            p=1/(1+10**(-(frozen[h]-frozen[a]+c['home'])/400))
            hg,ag=g['home_goals'],g['away_goals'];y=1 if hg>ag else .5 if hg==ag else 0
            margin=abs(hg-ag);factor=min(1.75,1+c['goal_margin']*(margin-1)) if margin>1 else 1
            move=c['k']*factor*(y-p);delta[h]+=move;delta[a]-=move
        for tid,d in delta.items():ratings[key][tid]+=d
    return ratings,goals

def build(bundle,finals,source,existing,clock):
    if clock.tzinfo is None:raise ValueError('aware clock required')
    if bundle['calibration']['status']!='research_only':raise ValueError('unexpected model status')
    byid={r['match_id']:r for r in existing};cache={};new=[]
    if len(byid)!=len(existing):raise ValueError('duplicate archived forecast')
    for row in existing:
        made=dt.datetime.fromisoformat(row['forecasted_at_utc']);start=dt.datetime.fromisoformat(row['kickoff_utc'])
        if row.get('model')!=MODEL or not made.tzinfo or not start.tzinfo or not made<start or made>clock:raise ValueError('invalid pregame archive')
        probabilities=[row[k] for k in ('p_home','p_draw','p_away')]
        if any(not math.isfinite(v) or not 0<=v<=1 for v in probabilities) or abs(sum(probabilities)-1)>1e-7:raise ValueError('invalid archived probabilities')
    for cohort,games in source.items():
        gender,div=cohort.split('-d')
        for item in games:
            from college_soccer_fixture_source import parse_start
            start=parse_start(item.get('game') or {})
            if start is None:continue
            day=start.astimezone(ET).date().isoformat()
            if max(bundle['goal_as_of'],bundle['shadow']['as_of'])>=day:continue
            if day not in cache:cache[day]=prior_state(bundle,finals,day)
            ratings,goals=cache[day]
            row=candidate(item,gender,int(div),ratings,bundle['shadow']['params'][cohort],clock)
            if row is None or row['match_id'] in byid:continue
            h,a=rates(goals[cohort],row['home_team'],row['away_team'])
            p=predict(row.pop('relative_home'),h,a,bundle['calibration']['cohorts'][cohort]['coefficients'])
            row.update({k:round(v,8) for k,v in p.items()})
            row.update({'model':MODEL,'status':'pregame_locked','forecasted_at_utc':clock.isoformat(),
                        'source_as_of':max([bundle['shadow']['as_of']]+[g['date'] for g in finals if g['date']<day]),
                        'expected_home_goals':h,'expected_away_goals':a,'goal_history_matches':goals[cohort]['matches'],
                        'goal_rate_prior_games':8,'training_cutoff':bundle['calibration']['training_cutoff']})
            if abs(sum(row[k] for k in ('p_home','p_draw','p_away'))-1)>1e-7:raise ValueError('bad probabilities')
            byid[row['match_id']]=row;new.append(row)
    return sorted(byid.values(),key=lambda r:(r['kickoff_utc'],r['match_id'])),new

def main():
    p=argparse.ArgumentParser();p.add_argument('--offline',action='store_true');args=p.parse_args()
    path=HERE/'data/college-soccer-prospective-v2.json'
    prior=read_json(path) if path.exists() else {}
    old=prior.get('forecasts',[])
    bundle=read_json(HERE/'data/college-soccer-dynamic-state.json')
    finals=read_json(HERE/'data/college-soccer-elo-final-ledger.json')['results']
    if args.offline:
        source,errors={},[]
        source_status=prior.get('source_status','not_checked')
    else:
        source,errors=fetch_scoreboards_with_audit(now_utc())
        source_status='complete' if not errors else 'unavailable' if len(errors)==18 else 'partial'
        atomic_json(HERE/'data/college-soccer-forecast-source-audit.json',{'checked_at':now_utc().isoformat(),'status':source_status,'scoreboards_expected':18,'scoreboards_succeeded':18-len(errors),'errors':errors})
    clock=now_utc() # Timestamp only after the network source has arrived.
    rows,new=build(bundle,finals,source,old,clock)
    expired={r['match_id'] for r in new if dt.datetime.fromisoformat(r['kickoff_utc'])<=now_utc()}
    rows=[r for r in rows if r['match_id'] not in expired]
    new=[r for r in new if r['match_id'] not in expired]
    envelope={'status':'prospective_research_only','model':MODEL,'count_locked':len(rows),'forecasts':rows,
              'published_at':max((r['forecasted_at_utc'] for r in rows),default=None),'source_status':source_status,
              'notice':'Matchup-specific research forecasts. Original v1 archive is retained separately.'}
    atomic_json(path,envelope)
    print(json.dumps({'locked':len(rows),'new':len(new),'distinct_draw_probabilities':len({r['p_draw'] for r in rows}),'source_status':source_status,'source_errors':len(errors)}))

if __name__=='__main__':main()

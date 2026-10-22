"""Validate externally supplied USRS forecasts before newspaper publication.

The prediction engine is private. This script does not fetch private data,
invent fixtures, or publish retrospective scores as future predictions.
"""
import argparse,datetime,json,math
from pathlib import Path

FIELDS=('home_win','draw','away_win')

def validate(payload,today=None):
    if payload.get('schema_version')!=1 or not isinstance(payload.get('matches'),list):raise ValueError('unsupported USRS schema')
    if payload.get('status')!='provisional_research':raise ValueError('unrecognized model status')
    if not isinstance(payload.get('model'),str) or not payload['model'].startswith('usrs-'):raise ValueError('missing model identity')
    today=today or datetime.datetime.now(datetime.timezone.utc).date()
    seen=set();clean=[]
    for m in payload['matches']:
        if not isinstance(m,dict):raise ValueError('invalid match')
        date=datetime.date.fromisoformat(m['date'])
        if date<today:raise ValueError('past fixtures cannot be published as upcoming forecasts')
        if date>today+datetime.timedelta(days=30):raise ValueError('fixture too far in future')
        if not all(isinstance(m.get(k),str) and m[k].strip() for k in ('home','away')):raise ValueError('missing teams')
        if m['home']==m['away']:raise ValueError('same home and away team')
        key=(m['date'],m['home'],m['away'])
        if key in seen:raise ValueError('duplicate fixture')
        seen.add(key)
        probs=[m.get(k) for k in FIELDS]
        if any(type(v) not in (int,float) or not math.isfinite(v) or not 0<v<1 for v in probs):raise ValueError('invalid probabilities')
        if abs(sum(probs)-1)>1e-8:raise ValueError('probabilities not normalized')
        if m.get('model_version')!=payload['model']:raise ValueError('mixed model versions')
        clean.append({k:m[k] for k in ('date','home','away',*FIELDS,'model_version')})
    if not clean:raise ValueError('no upcoming fixtures')
    return dict(schema_version=1,status=payload['status'],model=payload['model'],poisson_weight=payload.get('poisson_weight'),matches=clean)

def publish(source,target,today=None):
    data=validate(json.loads(Path(source).read_text()),today)
    dest=Path(target);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(data,indent=2)+'\n')
    return len(data['matches'])

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input_json');p.add_argument('output_json');a=p.parse_args()
    print(json.dumps({'published':publish(a.input_json,a.output_json)}))

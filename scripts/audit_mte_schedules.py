#!/usr/bin/env python3
"""Read-only 2026-27 MTE schedule audit. Never invent or write fixtures."""
import argparse, collections, datetime, json, pathlib, re, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
def norm(s):
    return re.sub(r'[^a-z0-9]+','',str(s).lower().replace('university','').replace('state','st'))
def load(path):
    with open(path,encoding='utf-8') as f:return json.load(f)
def records(folder):
    result={}
    for p in sorted(folder.glob('*.json')):
        try:
            obj=load(p)
            if not isinstance(obj,dict) or not isinstance(obj.get('events'),list):continue
            ident=str(obj.get('espn_team_id') or p.stem)
            result[ident]=obj
        except (OSError,ValueError) as e: print('WARNING',p,e,file=sys.stderr)
    return result
def rows(obj):
    own=str(obj.get('espn_team_id',''))
    for event in obj.get('events',[]):
        cs=(event.get('competitions') or [{}])[0].get('competitors') or []
        others=[x for x in cs if str((x.get('team') or {}).get('id',''))!=own]
        other=others[0].get('team',{}) if others else {}
        yield {'date':str(event.get('date',''))[:10],'opponent_id':str(other.get('id','')),
               'opponent':other.get('displayName') or event.get('name',''),
               'name':event.get('name',''),'tournament':event.get('tournament',''),
               'id':event.get('id',''),'event':event}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--inventory',default=str(ROOT/'data/mte-audit-2026-27.json'))
    ap.add_argument('--output',default=str(ROOT/'data/mte-comparison-2026-27.json'))
    ap.add_argument('--strict',action='store_true',help='exit nonzero on verified missing fixtures')
    args=ap.parse_args()
    inventory=load(args.inventory)
    genders={'men':records(ROOT/'data/mbb-schedules-2026-27'),
             'women':records(ROOT/'data/wbb-schedules-2026-27')}
    issues=[]; totals=collections.Counter()
    for gender,teams in genders.items():
        totals[gender+'_team_files']=len(teams)
        names={}
        for tid,obj in teams.items():
            for r in rows(obj):
                for c in (r['event'].get('competitions') or [{}])[0].get('competitors',[]):
                    t=c.get('team') or {}
                    if str(t.get('id'))==tid:
                        names.setdefault(norm(t.get('displayName','')),set()).add(tid)
        def resolve(name):
            found=names.get(norm(name),set())
            return next(iter(found)) if len(found)==1 else None
        for tid,obj in teams.items():
            seen=collections.Counter((r['date'],r['opponent_id']) for r in rows(obj) if r['opponent_id'])
            for (date,opp),count in seen.items():
                if count>1:
                    issues.append(dict(type='duplicate',gender=gender,team_id=tid,date=date,opponent_id=opp,count=count))
        for event in inventory.get('events',[]):
            if event.get('gender')!=gender:continue
            totals['events_checked']+=1
            for name in event.get('teams',[]):
                tid=resolve(name)
                if not tid:
                    issues.append(dict(type='unresolved_team',gender=gender,event=event['name'],team=name))
                    continue
                totals['participants_checked']+=1
                fixtures=list(rows(teams[tid]))
                for date in event.get('dates',[]):
                    if not any(r['date']==date for r in fixtures):
                        issues.append(dict(type='missing_date_candidate',gender=gender,event=event['name'],team=name,date=date,
                                           note='Date-only signal; may be a conditional championship or rest day'))
            fixed=[]
            for pair in event.get('opening_round',[]):
                fixed.append((event['dates'][0],pair))
            for g in event.get('games',[]):
                fixed.append((g['date'],g['pair']))
            for date,pair in fixed:
                a,b=(resolve(n) for n in pair)
                if not a or not b:
                    issues.append(dict(type='unresolved_matchup',gender=gender,event=event['name'],date=date,teams=pair))
                    continue
                for tid,other,name in [(a,b,pair[0]),(b,a,pair[1])]:
                    if not any(r['date']==date and r['opponent_id']==other for r in rows(teams[tid])):
                        issues.append(dict(type='missing_confirmed_fixture',gender=gender,event=event['name'],date=date,
                                           team=name,opponent=pair[1] if tid==a else pair[0],team_id=tid,opponent_id=other))
                totals['fixed_matchups_checked']+=1
    report={'season':inventory['season'],'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'read_only':True,'coverage':'Only events present in the curated inventory; not a complete season certification',
            'totals':dict(totals),'issue_counts':dict(collections.Counter(i['type'] for i in issues)),'issues':issues}
    out=pathlib.Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(out),'totals':report['totals'],'issue_counts':report['issue_counts']},indent=2))
    return int(args.strict and any(i['type']=='missing_confirmed_fixture' for i in issues))
if __name__=='__main__':sys.exit(main())

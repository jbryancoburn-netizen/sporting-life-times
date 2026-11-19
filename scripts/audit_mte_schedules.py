#!/usr/bin/env python3
"""Read-only 2026-27 MTE schedule audit. Never invent or write fixtures."""
import argparse, collections, datetime, json, pathlib, re, sys
from zoneinfo import ZoneInfo

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
    if 'games' in obj:
        for game in obj['games']:
            timestamp = game['date']
            date = timestamp[:10]
            if len(timestamp) > 10:
                date = datetime.datetime.fromisoformat(timestamp.replace('Z', '+00:00')).astimezone(
                    ZoneInfo('America/New_York')).date().isoformat()
            yield {'date': date, 'opponent_id': str(game.get('opponent_id') or ''),
                   'opponent': game.get('opponent', ''), 'id': game.get('id', ''), 'event': game}
        return
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
             'women':load(ROOT/'data/ncaaw-schedules-2026-27.json')['teams']}
    issues=[]; totals=collections.Counter(); verified=[]; events_checked=[]
    for gender,teams in genders.items():
        totals[gender+'_team_files']=len(teams)
        names={}
        for tid,obj in teams.items():
            # File metadata and the schedule's own competitor identity are both valid.
            # Avoid relying solely on a particular game having both competitors.
            for key in ('team_name','display_name','team_display_name','name','team'):
                if obj.get(key):
                    names.setdefault(norm(obj[key]),set()).add(tid)
            for alias in obj.get('aliases',[]):
                names.setdefault(norm(alias),set()).add(tid)
        for tid,obj in teams.items():
            for r in rows(obj):
                for c in (r['event'].get('competitions') or [{}])[0].get('competitors',[]):
                    t=c.get('team') or {}
                    if str(t.get('id'))==tid:
                        names.setdefault(norm(t.get('displayName','')),set()).add(tid)
                        if t.get('shortDisplayName'):
                            names.setdefault(norm(t['shortDisplayName']),set()).add(tid)
        aliases = inventory.get('team_aliases', {}).get(gender, {})
        registry_ids = {}
        if gender == 'men':
            registry = load(ROOT/'data/ncaam-2026-27-team-registry.json')['teams']
            schedule_ids = {obj.get('team_id'): tid for tid, obj in teams.items() if obj.get('team_id')}
            for team in registry:
                if team['id'] in schedule_ids:
                    registry_ids.setdefault(norm(team['name']), set()).add(schedule_ids[team['id']])

        def resolve(name):
            if name in aliases:
                return aliases[name] if aliases[name] in teams else None
            registered = registry_ids.get(norm(name), set())
            if len(registered) == 1:
                return next(iter(registered))
            key=norm(name)
            found=names.get(key,set())
            if len(found)==1:return next(iter(found))
            # Short school names often omit a mascot. Only use a prefix if unique.
            candidates=set().union(*(ids for label,ids in names.items()
                                     if label.startswith(key) and len(label)>len(key))) if key else set()
            return next(iter(candidates)) if len(candidates)==1 else None
        for tid,obj in teams.items():
            seen=collections.Counter((r['date'],r['opponent_id']) for r in rows(obj) if r['opponent_id'])
            for (date,opp),count in seen.items():
                if count>1:
                    issues.append(dict(type='duplicate',gender=gender,team_id=tid,date=date,opponent_id=opp,count=count))
        for event in inventory.get('events',[]):
            if event.get('gender')!=gender:continue
            totals['events_checked']+=1
            events_checked.append(dict(name=event['name'], gender=gender, source=event.get('source'),
                                       listed_participants=len(event.get('teams', [])),
                                       fixed_matchups=len(event.get('games', []))+len(event.get('opening_round', []))))
            if event.get('pending_round'):
                issues.append(dict(type='bracket_opponents_pending',gender=gender,event=event['name'],
                                   note=event['pending_round']))
            if not event.get('teams') or not event.get('dates'):
                issues.append(dict(type='inventory_incomplete',gender=gender,event=event['name'],
                                   note='Missing verified participants and/or dates; fixture audit not possible'))
                totals['events_incomplete']+=1
                continue
            totals['events_with_fields']+=1
            for name in event.get('teams',[]):
                tid=resolve(name)
                if not tid or tid not in teams:
                    issues.append(dict(type='unresolved_team',gender=gender,event=event['name'],team=name))
                    continue
                totals['participants_checked']+=1
                fixtures=list(rows(teams[tid]))
                # Only infer a required date when the event guarantees a game every listed day.
                # Preset-matchup events, showcases and championship-only days are not daily guarantees.
                for date in (event.get('dates',[]) if event.get('daily_game_guarantee') is True else []):
                    if not any(r['date']==date for r in fixtures):
                        issues.append(dict(type='missing_date_candidate',gender=gender,event=event['name'],team=name,date=date,
                                           note='Date-only signal; may be a conditional championship or rest day'))
            fixed=[]
            for pair in event.get('opening_round',[]):
                fixed.append((event['dates'][0],pair))
            for g in event.get('games',[]):
                fixed.append((g['date'],g['pair']))
            fixed=list({(date,tuple(sorted(pair))):(date,pair) for date,pair in fixed}.values())
            if not fixed:
                issues.append(dict(type='matchups_unverified',gender=gender,event=event['name']))
            for date,pair in fixed:
                a,b=(resolve(n) for n in pair)
                if not a or not b or a not in teams or b not in teams:
                    issues.append(dict(type='unresolved_matchup',gender=gender,event=event['name'],date=date,teams=pair))
                    continue
                present=0
                for tid,other,name in [(a,b,pair[0]),(b,a,pair[1])]:
                    matching=[r for r in rows(teams[tid]) if r['date']==date and r['opponent_id']==other]
                    if matching:
                        present+=1
                        totals['confirmed_team_entries_already_present']+=1
                        verified.append(dict(gender=gender,event=event['name'],date=date,team=name,
                                             opponent_id=other,team_id=tid,status='already_present',
                                             game_ids=[r['id'] for r in matching]))
                    else:
                        same_day=[r for r in rows(teams[tid]) if r['date']==date]
                        issue_type='opponent_mismatch_or_placeholder' if same_day else 'missing_confirmed_fixture'
                        issues.append(dict(type=issue_type,gender=gender,event=event['name'],date=date,
                                           team=name,opponent=pair[1] if tid==a else pair[0],team_id=tid,
                                           opponent_id=other,existing_same_day=[dict(opponent_id=r['opponent_id'],
                                           opponent=r['opponent'],game_id=r['id']) for r in same_day]))
                totals['fixed_matchups_checked']+=1
                if present==2:
                    totals['reciprocal_matchups_verified']+=1
    report={'season':inventory['season'],'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'read_only':True,'coverage':'Only events present in the curated inventory; not a complete season certification',
            'events_checked':events_checked,'totals':dict(totals),'issue_counts':dict(collections.Counter(i['type'] for i in issues)),'issues':issues,'verified_existing_fixtures':verified}
    out=pathlib.Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(out),'totals':report['totals'],'issue_counts':report['issue_counts']},indent=2))
    return int(args.strict and any(i['type'] in {'missing_confirmed_fixture', 'opponent_mismatch_or_placeholder'} for i in issues))
if __name__=='__main__':sys.exit(main())

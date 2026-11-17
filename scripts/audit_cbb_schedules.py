#!/usr/bin/env python3
"""Read-only 2026–27 men's schedule consistency audit. No guessed corrections.
Run from repository root: python3 scripts/audit_cbb_schedules.py
Writes JSON report to stdout; exits 1 when blocking inconsistencies exist.
Official-source comparison remains a separate requirement.
"""
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
def load(path):
    with open(path,encoding='utf-8') as f:return json.load(f)
def main():
    cross=load(DATA/'ncaam-2026-27-espn-team-crosswalk.json')
    retro=load(DATA/'ncaam-2026-27-retro-primary.json')
    by_espn={str(t['espn_id']):t for t in cross['teams']}
    by_ncaa={str(t['id']):str(t['espn_id']) for t in cross['teams']}
    issues=[]; files=0; fixtures=0; schedule_index=defaultdict(list)
    def issue(code,team,day='',event='',detail=''):
        issues.append(dict(code=code,team=str(team),date=str(day),event=str(event),detail=str(detail)))
    for espn,t in by_espn.items():
        path=DATA/'mbb-schedules-2026-27'/f'{espn}.json'
        if not path.exists():
            issue('MISSING_SCHEDULE_FILE',espn,detail=t.get('name',''));continue
        files+=1
        try:data=load(path)
        except (OSError,ValueError) as exc:
            issue('UNREADABLE_SCHEDULE',espn,detail=str(exc));continue
        if data.get('coverage','').lower().startswith('partial'):
            issue('PARTIAL_COVERAGE',espn,detail=data['coverage'])
        seen=set()
        for e in data.get('events',[]):
            fixtures+=1
            day=str(e.get('date',''))[:10]
            comps=(e.get('competitions') or [{}])[0].get('competitors') or []
            if len(comps)!=2:
                issue('INVALID_COMPETITORS',espn,day,e.get('id',''));continue
            ids=[str(c.get('team',{}).get('id','')) for c in comps]
            if espn not in ids or ids[0]==ids[1]:
                issue('TEAM_ID_MISMATCH',espn,day,e.get('id',''),ids);continue
            opponent=ids[1] if ids[0]==espn else ids[0]
            k=(day,opponent)
            if k in seen:issue('DUPLICATE_DAY_OPPONENT',espn,day,e.get('id',''),opponent)
            seen.add(k)
            try:datetime.strptime(day,'%Y-%m-%d')
            except ValueError:issue('INVALID_DATE',espn,day,e.get('id',''))
            # Imported school calendar placeholders are not verified tipoff times.
            raw_date=str(e.get('date',''))
            if str(e.get('id','')).startswith('school-') and ('T12:00:00' in raw_date or 'T17:00:00Z' in raw_date):
                if not e.get('official_school_time'):
                    issue('UNVERIFIED_TIPOFF_PLACEHOLDER',espn,day,e.get('id',''),raw_date)
            venue=(e.get('competitions') or [{}])[0].get('venue') or {}
            venue_name=str(venue.get('fullName','')).strip()
            if venue_name and (venue_name==str(e.get('official_time','')).strip() or
                               venue_name.startswith(('Mon ', 'Tue ', 'Wed ', 'Thu ', 'Fri ', 'Sat ', 'Sun '))):
                issue('VENUE_CONTAINS_DATE',espn,day,e.get('id',''),venue_name)
            neutral=e.get('neutralSite') is True
            roles={str(c['team']['id']):c.get('homeAway') for c in comps}
            if neutral and any(role in ('home','away') for role in roles.values()):
                issue('NEUTRAL_ROLE_CONFLICT',espn,day,e.get('id',''),roles)
            if not neutral and set(roles.values())=={'neutral'}:
                issue('NONNEUTRAL_ROLE_CONFLICT',espn,day,e.get('id',''),roles)
            schedule_index[(espn,day,opponent)].append(e)
    finals=0
    for g in retro.get('events',[]):
        h=by_ncaa.get(str(g.get('home_id')));a=by_ncaa.get(str(g.get('away_id')))
        day=str(g.get('date',''))
        if not h or not a:continue
        finals+=1
        for team,opp in ((h,a),(a,h)):
            candidates=schedule_index.get((team,day,opp),[])
            if not candidates:
                issue('MISSING_VERIFIED_FINAL',team,day,g.get('id',''),f'opponent={opp}')
                continue
            if len(candidates)>1:continue
            e=candidates[0]
            comps=e['competitions'][0]['competitors']
            scores={str(c['team']['id']):c.get('score') for c in comps}
            if scores.get(h) is not None and scores.get(a) is not None:
                try:match=int(scores[h])==int(g['home_score']) and int(scores[a])==int(g['away_score'])
                except (TypeError,ValueError):match=False
                if not match:issue('FINAL_SCORE_CONFLICT',team,day,g.get('id',''),scores)
            if g.get('site_verified') is True and g.get('neutral') is False and e.get('neutralSite') is True:
                issue('VENUE_CLASS_CONFLICT',team,day,g.get('id',''),'RETRO verified nonneutral; schedule neutral')
    counts=defaultdict(int)
    for i in issues:counts[i['code']]+=1
    print(json.dumps({'scope':'2026-27 mens Division I local consistency; NOT external verification',
       'expected_teams':len(by_espn),'schedule_files':files,'schedule_entries':fixtures,
       'retro_finals_checked':finals,'issue_counts':dict(sorted(counts.items())),
       'issues':issues},indent=2))
    return 1 if any(x['code'] in {'MISSING_SCHEDULE_FILE','INVALID_COMPETITORS','TEAM_ID_MISMATCH','MISSING_VERIFIED_FINAL','FINAL_SCORE_CONFLICT','VENUE_CLASS_CONFLICT'} for x in issues) else 0
if __name__=='__main__':raise SystemExit(main())

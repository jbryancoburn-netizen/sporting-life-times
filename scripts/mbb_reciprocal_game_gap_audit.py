#!/usr/bin/env python3
"""Audit games absent from one D-I schedule but present on an official opponent calendar.

Read only. Records candidates and conflicts; never invents a fixture.
"""
import collections
import datetime
import json
import pathlib
from urllib.parse import urlsplit

DATA=pathlib.Path(__file__).resolve().parents[1]/'data'
SCHEDULES=DATA/'mbb-schedules-2026-27'
CROSS=DATA/'ncaam-2026-27-espn-team-crosswalk.json'
BAD_HOSTS=('espn.com','sports-reference.com','wikipedia.org','realgm.com','github.com')

def source_is_official(url):
    try:
        parsed=urlsplit(str(url or ''))
        host=(parsed.hostname or '').lower()
        return parsed.scheme=='https' and bool(host) and not any(host==b or host.endswith('.'+b) for b in BAD_HOSTS)
    except (TypeError,ValueError):return False

def normalized(s):
    import re
    return re.sub(r'[^a-z0-9]','',str(s or '').lower())

def run():
    teams=json.loads(CROSS.read_text())['teams']
    known={str(t['espn_id']) for t in teams}
    assert len(known)==365
    names=collections.defaultdict(set)
    for t in teams:
        for label in (t['name'],t.get('espn_name')):
            if label:names[normalized(label)].add(str(t['espn_id']))
    for label,sid in {'bostonuniversity':'104','bostonu':'104','umass':'113','massachusetts':'113','umasslowell':'2349','westernkentucky':'98','kentucky':'96','bostoncollege':'103'}.items():
        names[label].add(sid)
    docs={}
    for owner in known:
        path=SCHEDULES/(owner+'.json')
        if not path.exists():raise RuntimeError('Missing '+str(path))
        docs[owner]=json.loads(path.read_text())
    sources=collections.defaultdict(list)
    game_index=collections.defaultdict(list)
    for owner,doc in docs.items():
        for event in doc.get('events',[]):
            c=(event.get('competitions') or [{}])[0]
            ps=c.get('competitors') or []
            if len(ps)!=2:continue
            ids=[str((p.get('team') or {}).get('id') or '') for p in ps]
            if owner not in ids or any(i not in known for i in ids) or ids[0]==ids[1]:continue
            day=str(event.get('date') or '')[:10]
            try:datetime.date.fromisoformat(day)
            except ValueError:continue
            pair=tuple(sorted(ids))
            key=(day,pair)
            game_index[key].append((owner,event))
            if event.get('site_verified') is not True:continue
            source=event.get('school_source_url') or event.get('site_source_url') or doc.get('source_url')
            if not source_is_official(source):continue
            if event.get('verified_by_opponent_school') is True or (
                event.get('source_school_id') and str(event.get('source_school_id'))!=owner):continue
            by={str((p.get('team') or {}).get('id') or ''):p.get('homeAway') for p in ps}
            if set(by)!=set(ids) or by[ids[0]] not in ('home','away','neutral'):continue
            if {'home':'away','away':'home','neutral':'neutral'}[by[ids[0]]]!=by[ids[1]]:continue
            sources[key].append((owner,event,source))
    candidates=[];rejected=collections.Counter();quarantined=[]
    def quarantine(reason, day, pair, source_owner, event, origin='', **details):
        rejected[reason]+=1
        if len(quarantined)<200:
            quarantined.append({
                'reason':reason,'date':day,'source_school_id':source_owner,
                'target_school_id':pair[0] if pair[1]==source_owner else pair[1],
                'source_event_id':event.get('id'),'source_game_name':event.get('name'),
                'source_url':origin,**details
            })
    for key,owner_rows in sorted(game_index.items()):
        day,pair=key
        present={o for o,_ in owner_rows}
        if len(present)!=1 or len(owner_rows)!=1:continue
        owner=next(iter(present))
        target=pair[0] if pair[1]==owner else pair[1]
        own_sources=[r for r in sources.get(key,[]) if r[0]==owner]
        if len(own_sources)!=1:
            quarantine('no_unique_official_source',day,pair,owner,owner_rows[0][1],
                       source_record_count=len(own_sources))
            continue
        _,event,origin=own_sources[0]
        raw=normalized(event.get('name'))
        identified=names.get(raw,set())
        if len(identified)!=1 or target not in identified:
            quarantine('source_opponent_identity_unconfirmed',day,pair,owner,event,origin,
                       recognized_team_ids=sorted(identified))
            continue
        # Directly verified university calendars have authority over
        # inferred opponent-only imports. Escalate rather than auto-add.
        if docs[target].get('verified_from_school') is True:
            quarantine('independent_target_calendar_requires_source_review',day,pair,owner,event,origin,
                       target_schedule_url=docs[target].get('source_url'))
            continue
        same_day=[e for e in docs[target].get('events',[])
                  if str(e.get('date') or '')[:10]==day]
        if same_day:
            quarantine('different_opponent_already_on_target_date',day,pair,owner,event,origin,
                       existing_target_events=[
                           {'id':e.get('id'),'name':e.get('name')} for e in same_day[:5]])
            continue
        # Never duplicate a same-opponent game on a nearby date if the two
        # school calendars disagree over timezone/day or an event ID.
        collision=[]
        for e in docs[target].get('events',[]):
            c=(e.get('competitions') or [{}])[0]
            roster=c.get('competitors') or []
            opp=next((person for person in roster if str((person.get('team') or {}).get('id') or '')==owner),None)
            if not opp:continue
            date=str(e.get('date') or '')[:10]
            try:distance=abs((datetime.date.fromisoformat(date)-datetime.date.fromisoformat(day)).days)
            except ValueError:continue
            if distance<=1:collision.append(e.get('id'))
        if collision:
            quarantine('near_date_opponent_collision',day,pair,owner,event,origin,
                       conflicting_target_event_ids=collision[:6])
            continue
        candidates.append({
            'target_id':target,'opponent_id':owner,'date':day,
            'opponent_game_id':event.get('id'),'official_source_url':origin,
            'venue':(event.get('competitions') or [{}])[0].get('venue',{}).get('arenaName'),
            'source_has_tv':bool((event.get('competitions') or [{}])[0].get('broadcasts')),
            'source_has_clock':bool(event.get('official_school_time') or event.get('official_time'))
        })
    by_target=collections.Counter(x['target_id'] for x in candidates)
    report={
        'summary':{
            'schools_scanned':len(docs),
            'paired_existing_games':sum(len({o for o,_ in events})==2 for events in game_index.values()),
            'single_owner_groups':sum(len({o for o,_ in events})==1 for events in game_index.values()),
            'unique_official_candidates':len(candidates),
            'schools_with_candidate_gaps':len(by_target),
            'rejected':dict(rejected),
        },
        'candidates':candidates,
        'quarantined_examples':quarantined,
        'by_target':[{'school_id':k,'candidate_games':n} for k,n in by_target.most_common()],
        'policy':'Read-only: exact date and two D-I team IDs, independent official source/opponent identity, unique game and reciprocal home/away; existing school authority and same/near-date conflicts quarantined; never add fixtures automatically.'
    }
    (DATA/'mbb-reciprocal-game-coverage-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    manifest=DATA/'mbb-official-recheck-365-verification.json'
    if manifest.exists():
        old=json.loads(manifest.read_text())
        old['reciprocal_game_coverage']=report
        manifest.write_text(json.dumps(old,indent=2)+'\n')
    print(json.dumps(report['summary'],indent=2))
    return report

if __name__=='__main__':run()

#!/usr/bin/env python3
"""Apply reviewed game-specific athletics announcements to both D-I schedules.

No source guessing, changes to Elo, game-ID churn, or new fixtures. A fact
is applied only to one uniquely identified game on that owner's calendar.
"""
import collections
import json
import pathlib
import re

DATA=pathlib.Path(__file__).resolve().parents[1]/'data'
SOURCE=DATA/'mbb-reviewed-athletics-announcements-2026-27.json'
SCHEDULES=DATA/'mbb-schedules-2026-27'
CLOCK=re.compile(r"(?i)^(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)(?:\s+(?:ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?$|^(?:noon|midnight)(?:\s+(?:ET|CT|MT|PT))?$")
ALIASES={'CBS SPORTS NETWORK':'CBSSN','NBC SPORTS NETWORK':'NBCSN','FOX9+':'FOX 9+'}

def norm(value):
    label=re.sub(r'\s+',' ',str(value or '').strip().upper())
    return ALIASES.get(label,label)

def existing_labels(event):
    c=(event.get('competitions') or [{}])[0]
    found=[]
    for obj in (c.get('broadcasts') or [])+(event.get('broadcasts') or []):
        if isinstance(obj,str):found.extend(obj.split('/'))
        elif isinstance(obj,dict):
            names=obj.get('names') or ([obj['name']] if obj.get('name') else [])
            if isinstance(names,str):names=[names]
            for name in names:found.extend(str(name).split('/'))
    if isinstance(event.get('broadcast'),str):
        found.extend(event['broadcast'].split('/'))
    return {norm(x) for x in found if norm(x)}

def valid_venue(value):
    x=str(value or '').strip()
    if not x or re.search(r'(?i)^(?:tba|tbd|unknown|center|arena|fieldhouse|select location)$',x):
        return False
    return not re.search(r'(?i)^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b',x)

def execute():
    source=json.loads(SOURCE.read_text())
    docs={}
    catalog=json.loads((DATA/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
    assert len(catalog)==365
    for school in catalog:
        sid=str(school['espn_id']);p=SCHEDULES/(sid+'.json')
        if not p.exists():raise RuntimeError('Missing school schedule '+sid)
        docs[sid]=(p,json.loads(p.read_text()))
    summary=collections.Counter();changes=[];issues=[];changed_schools=set()
    for fact in source['games']:
        day=fact['date'];ids=set(map(str,fact['teams']))
        if len(ids)!=2 or any(x not in docs for x in ids) or not re.fullmatch(r'202[67]-\d\d-\d\d',day):
            raise ValueError('Invalid reviewed matchup: '+str(fact))
        url=fact['source_url']
        if not url.startswith('https://'):raise ValueError('Unsourced announcement')
        for owner in sorted(ids):
            p,doc=docs[owner]
            matched=[]
            for event in doc.get('events',[]):
                c=(event.get('competitions') or [{}])[0]
                team_ids={str((x.get('team') or {}).get('id') or '') for x in c.get('competitors') or []}
                if event.get('date','')[:10]==day and team_ids==ids:
                    matched.append(event)
            if len(matched)!=1:
                summary['unmatched_or_ambiguous_owner_records']+=1
                issues.append({'date':day,'owner':owner,'opponent_ids':sorted(ids),'issue':'unique_existing_game_not_found','matches':len(matched)})
                continue
            event=matched[0];comp=event['competitions'][0]
            updated=[]
            targets=[str(x).strip() for x in fact.get('networks',[]) if x]
            if targets:
                prior=existing_labels(event)
                allow={norm(x) for x in fact.get('add_if_existing',[])}
                if prior and not allow:
                    if any(norm(t) not in prior for t in targets):
                        summary['broadcast_conflicts']+=1
                        issues.append({'date':day,'owner':owner,'event_id':event.get('id'),'issue':'announced_network_differs','existing':sorted(prior),'announced':targets})
                elif prior and not prior.issubset(allow):
                    summary['broadcast_conflicts']+=1
                    issues.append({'date':day,'owner':owner,'event_id':event.get('id'),'issue':'unapproved_simulcast_older_network','existing':sorted(prior),'allowed':sorted(allow)})
                else:
                    missing=[t for t in targets if norm(t) not in prior]
                    if missing:
                        broadcasts=comp.get('broadcasts')
                        if not isinstance(broadcasts,list):broadcasts=[]
                        broadcasts.append({'names':missing,'source_url':url,'verified_via':'reviewed_official_game_specific_announcement'})
                        comp['broadcasts']=broadcasts
                        event['broadcast_source_url']=url
                        summary['broadcast_labels_added']+=len(missing)
                        updated.append('broadcast')
            tm=str(fact.get('time') or '')
            if tm:
                if not CLOCK.fullmatch(tm):raise ValueError('Unvalidated time: '+tm)
                previous=[event.get('official_school_time'),event.get('official_time')]
                if not any(CLOCK.fullmatch(str(value or '').strip()) for value in previous):
                    event['official_school_time']=tm
                    event['official_school_time_source']=url
                    event['official_school_time_verified_via']='reviewed_official_game_specific_announcement'
                    summary['tipoffs_added']+=1;updated.append('tipoff')
            v=comp.setdefault('venue',{})
            if fact.get('venue') and not valid_venue(v.get('arenaName')):
                v.update(arenaName=fact['venue'],arena_source_url=url,arena_source_type='reviewed_game_specific_athletics_announcement')
                if not valid_venue(v.get('fullName')):v['fullName']=fact['venue']
                summary['arenas_added']+=1;updated.append('arena')
            if fact.get('city') and not (v.get('official_school_city') or (v.get('address') or {}).get('city')):
                v.update(official_school_city=fact['city'],city_source_url=url)
                summary['cities_added']+=1;updated.append('city')
            if updated:
                changed_schools.add(owner)
                summary['game_entries_changed']+=1
                changes.append({'owner':owner,'date':day,'event_id':event.get('id'),
                                'fields':updated,'source_url':url})
    for owner in changed_schools:
        p,doc=docs[owner]
        p.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':'))+'\n')
    summary['schools_scanned']=len(docs)
    summary['schools_changed']=len(changed_schools)
    summary['reviewed_unique_games']=len(source['games'])
    post=collections.Counter()
    for _,doc in docs.values():
        for event in doc.get('events',[]):
            post['game_entries']+=1
            if not CLOCK.fullmatch(str(event.get('official_school_time') or '').strip()) and not CLOCK.fullmatch(str(event.get('official_time') or '').strip()):
                post['missing_tipoff']+=1
            comp=(event.get('competitions') or [{}])[0]
            if not (comp.get('broadcasts') or event.get('broadcasts') or event.get('broadcast')):
                post['missing_broadcast']+=1
            if event.get('site_verified') is not True:
                post['site_unverified']+=1
    summary['post_announcement_field_audit']=dict(post)
    report={'summary':dict(summary),'policy':'Exact date+two ESPN school IDs; only explicitly reviewed official school announcements; no overwrite of contradictory networks; approved simultaneity only; game IDs untouched.',
            'changes':changes,'issues':issues}
    (DATA/'mbb-reviewed-athletics-announcements-recovery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    manifest=DATA/'mbb-official-recheck-365-verification.json'
    if manifest.exists():
        doc=json.loads(manifest.read_text())
        doc['reviewed_official_announcements']=report
        doc['final_field_audit']=dict(post)
        manifest.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['summary'],indent=2))
    return report

if __name__=='__main__':
    execute()

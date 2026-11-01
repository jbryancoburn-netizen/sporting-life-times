#!/usr/bin/env python3
"""Read-only, season-wide audit of basketball arena citation integrity.

Official school URLs must belong to one of the participating schools when
they are represented as school-provided arena evidence. Conference/event
organizer URLs are reported separately and never automatically rejected.
"""
import collections
import json
import pathlib
import re
from urllib.parse import urlsplit

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
FOLDER=DATA/'mbb-schedules-2026-27'
REPORT=DATA/'mbb-venue-provenance-audit.json'

def host(raw):
    try:
        value=(urlsplit(str(raw or '')).hostname or '').lower()
    except (ValueError,TypeError):
        return ''
    return value.removeprefix('www.')

def fixture(event):
    comp=(event.get('competitions') or [{}])[0]
    return [str((x.get('team') or {}).get('id') or '') for x in comp.get('competitors') or []]

def audit():
    members=json.loads((DATA/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
    school_ids={str(t['espn_id']) for t in members}
    assert len(school_ids)==365
    docs={}
    school_hosts=collections.defaultdict(set)
    for owner in school_ids:
        p=FOLDER/(owner+'.json')
        if not p.exists():raise FileNotFoundError(p)
        doc=json.loads(p.read_text());docs[owner]=doc
        raw=host(doc.get('source_url'))
        if raw:school_hosts[raw].add(owner)
    stats=collections.Counter();issues=[];priority=[];by_school=collections.Counter()
    for owner,doc in sorted(docs.items()):
        for event in doc.get('events',[]):
            stats['entries_scanned']+=1
            pair=set(fixture(event))
            if len(pair)!=2 or owner not in pair:
                stats['invalid_event_team_pair']+=1;continue
            v=(event.get('competitions') or [{}])[0].get('venue') or {}
            arena=str(v.get('arenaName') or '').strip()
            src=str(v.get('arena_source_url') or '').strip()
            source_kind=str(v.get('arena_source_type') or '').strip()
            if not arena:
                stats['entries_without_arena']+=1;continue
            stats['entries_with_arena']+=1
            reasons=[]
            if 'default_not_game_specific' in source_kind.lower():
                stats['provisional_home_arena']+=1
                reasons.append('generic_home_arena_not_game_specific')
            if not src:
                stats['arena_citation_missing']+=1
                reasons.append('arena_source_unrecorded')
            sh=host(src)
            represented=school_hosts.get(sh,set())
            if represented and represented.isdisjoint(pair):
                stats['arena_cited_from_unrelated_school']+=1
                reasons.append('unrelated_university_arena_source')
            if re.fullmatch(r'(?i)(?:arena|center|centre|gym|gymnasium|fieldhouse|court|stadium|tbd|tba|unknown|select location)',arena):
                stats['generic_arena_label']+=1
                reasons.append('generic_arena_label')
            if re.search(r'(?i)^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d',arena):
                stats['date_misfiled_as_arena']+=1
                reasons.append('date_label_is_not_an_arena')
            if reasons:
                by_school[owner]+=1
                detail={
                    'school_id':owner,'event_id':event.get('id'),
                    'date':str(event.get('date') or '')[:10],
                    'teams':sorted(pair),'arena':arena,'arena_source_url':src,
                    'arena_source_type':source_kind,
                    'citation_owner_ids':sorted(represented),
                    'issues':reasons
                }
                if len(issues)<350:issues.append(detail)
                if 'unrelated_university_arena_source' in reasons:priority.append(detail)
    stats['schools_scanned']=len(docs)
    stats['schools_with_flagged_records']=len(by_school)
    report={
        'season':'2026-27',
        'summary':dict(stats),
        'policy':'Diagnostic only. Quarantine weak/default/unrelated-school arena citations; never replace or remove a venue without game-specific university/conference evidence.',
        'flagged_examples':issues,
        'urgent_unrelated_school_citations':priority,
        'schools_with_issues':[{'school_id':i,'flagged_entries':n} for i,n in by_school.most_common()]
    }
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    manifest=DATA/'mbb-official-recheck-365-verification.json'
    if manifest.exists():
        d=json.loads(manifest.read_text())
        d['arena_source_integrity_audit']={'summary':dict(stats),'flagged_examples':issues[:50],
             'urgent_unrelated_school_citations':priority,'policy':report['policy']}
        manifest.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['summary'],indent=2))
    print(json.dumps({'urgent_unrelated_school_citations':priority},indent=2))
    return report

if __name__=='__main__':audit()

#!/usr/bin/env python3
"""Correct official school schedule opponent identities only with reciprocal proof.

Never create a new fixture, change an event ID, or trust substring matching.
A source-owned original official-school event must have a unique literal
opponent identity and a reciprocally verified opponent schedule event.
"""
import collections
import json
import pathlib
import re
from urllib.parse import urlsplit

DATA=pathlib.Path(__file__).resolve().parents[1]/'data'
FOLDER=DATA/'mbb-schedules-2026-27'
ALIASES={
 'bostonuniversity':'104','bostonu':'104',
 'bostoncollege':'103','umass':'113','universityofmassachusetts':'113',
 'massachusetts':'113','umassamherst':'113','umasslowell':'2349',
 'westernkentucky':'98','westernky':'98',
 'kentucky':'96','northernkentucky':'94',
 'ucf':'2116','centralflorida':'2116',
}

def key(name):
    return re.sub('[^a-z0-9]','',str(name or '').lower())

def official(url):
    try:
        p=urlsplit(str(url or ''));host=(p.hostname or '').lower()
    except (TypeError,ValueError):return False
    if p.scheme!='https' or not host:return False
    return not any(host==s or host.endswith('.'+s) for s in ('espn.com','github.com','wikipedia.org','realgm.com','sports-reference.com'))

def run():
    cross=json.loads((DATA/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
    ids={str(x['espn_id']):x for x in cross}
    assert len(ids)==365
    mapping=collections.defaultdict(set)
    for t in cross:
        for name in (t['name'],t.get('espn_name')):
            if name:mapping[key(name)].add(str(t['espn_id']))
    for name,sid in ALIASES.items():mapping[name].add(sid)
    def resolve(raw):
        candidates=mapping.get(key(raw),set())
        return next(iter(candidates)) if len(candidates)==1 else ''
    docs={}
    for owner in ids:
        path=FOLDER/(owner+'.json')
        if not path.exists():raise RuntimeError('Missing school '+owner)
        docs[owner]=(path,json.loads(path.read_text()))
    by_owner_date=collections.defaultdict(list)
    for owner,(_,d) in docs.items():
        for e in d.get('events',[]):
            by_owner_date[(owner,str(e.get('date') or '')[:10])].append(e)
    changes=[];review=[];changed=set();counts=collections.Counter()
    for owner,(_,doc) in docs.items():
        # Only the university's OWN originally ingested calendar can identify
        # its opponent; opponent-derived calendars may contain prior bad IDs.
        if doc.get('verified_from_school') is not True:continue
        for e in doc.get('events',[]):
            c=(e.get('competitions') or [{}])[0];competitors=c.get('competitors') or []
            if len(competitors)!=2 or e.get('official_source') is not True:continue
            if not official(e.get('school_source_url') or doc.get('source_url')):continue
            ownerTeam=next((p for p in competitors if str((p.get('team') or {}).get('id'))==owner),None)
            if ownerTeam is None:continue
            counterpart=next((p for p in competitors if p is not ownerTeam),None)
            if counterpart is None:continue
            old_id=str((counterpart.get('team') or {}).get('id') or '')
            raw=str(e.get('name') or '').strip()
            corrected_id=resolve(raw)
            if not corrected_id or corrected_id==old_id or corrected_id==owner:continue
            counts['candidate_identity_mismatches']+=1
            day=str(e.get('date') or '')[:10]
            # Do not modify where one school has multiple games that date.
            if len(by_owner_date[(owner,day)])!=1:counts['ambiguous_owner_same_date']+=1;continue
            peerDoc=docs[corrected_id][1]
            if peerDoc.get('verified_from_school') is not True:
                counts['peer_source_not_independently_official']+=1
                if len(review)<220:review.append({'owner':owner,'date':day,'old_id':old_id,'proposed_id':corrected_id,'raw':raw,'reason':'peer_source_not_verified'})
                continue
            reciprocal=[]
            for peer in by_owner_date[(corrected_id,day)]:
                pc=(peer.get('competitions') or [{}])[0]
                pids=[str((p.get('team') or {}).get('id') or '') for p in pc.get('competitors') or []]
                if owner in pids and corrected_id in pids and peer.get('official_source') is True and official(peer.get('school_source_url') or peerDoc.get('source_url')):
                    reciprocal.append(peer)
            if len(reciprocal)!=1 or len(by_owner_date[(corrected_id,day)])!=1:
                counts['no_unique_independent_reciprocal']+=1
                if len(review)<220:review.append({'owner':owner,'date':day,'old_id':old_id,'proposed_id':corrected_id,'raw':raw,'reason':'no_unique_independent_peer'})
                continue
            # Even a source-name match cannot trump a verified conflicting
            # matchup already on the old opponent's own calendar.
            otherDoc=docs.get(old_id,(None,{}))[1]
            if otherDoc.get('verified_from_school') is True:
                conflicts=[]
                for old_event in by_owner_date[(old_id,day)]:
                    pids={str((p.get('team') or {}).get('id') or '') for p in ((old_event.get('competitions') or [{}])[0].get('competitors') or [])}
                    if owner in pids:conflicts.append(old_event.get('id'))
                if conflicts:
                    counts['old_opponent_conflict']+=1
                    if len(review)<220:review.append({'owner':owner,'date':day,'old_id':old_id,'proposed_id':corrected_id,'raw':raw,'reason':'old_opponent_has_conflicting_game'})
                    continue
            ownSide=ownerTeam.get('homeAway')
            peerSide=next((p.get('homeAway') for p in reciprocal[0]['competitions'][0]['competitors'] if str(p.get('team',{}).get('id'))==owner),'')
            if ownSide in ('home','away','neutral') and peerSide in ('home','away','neutral') and ownSide!=peerSide:
                counts['site_disagreement']+=1
                if len(review)<220:review.append({'owner':owner,'date':day,'old_id':old_id,'proposed_id':corrected_id,'raw':raw,'reason':'home_away_conflict'})
                continue
            counterpart['team']['id']=corrected_id
            counterpart['team']['displayName']=ids[corrected_id].get('espn_name') or ids[corrected_id]['name']
            counterpart['team']['logo']=f'https://a.espncdn.com/i/teamlogos/ncaa/500/{corrected_id}.png'
            e['official_opponent_identity_source']=e.get('school_source_url') or doc.get('source_url')
            e['official_opponent_identity_verified_via']='literal_school_opponent_and_unique_reciprocal_official_game'
            e['official_opponent_id_corrected_from']=old_id
            changed.add(owner)
            changes.append({'owner':owner,'date':day,'event_id':e.get('id'),'name':raw,'from_id':old_id,'to_id':corrected_id,
                            'official_source_url':e['official_opponent_identity_source'],
                            'reciprocal_event_id':reciprocal[0].get('id')})
            counts['opponent_ids_corrected']+=1
    for owner in changed:
        path,doc=docs[owner]
        path.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':'))+'\n')
    report={'summary':{'schools_scanned':365,'schools_changed':len(changed),**dict(counts)},
            'policy':'Original official school game + unique exact normalized school identity + unique independently official reciprocal peer same date; preserve event IDs; no new games; collisions flagged.',
            'changes':changes,'review':review}
    (DATA/'mbb-verified-opponent-identity-repair.json').write_text(json.dumps(report,indent=2)+'\n')
    manifest=DATA/'mbb-official-recheck-365-verification.json'
    if manifest.exists():
        m=json.loads(manifest.read_text());m['verified_opponent_identity_repair']=report
        manifest.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps(report['summary'],indent=2))
    return report

if __name__=='__main__':run()

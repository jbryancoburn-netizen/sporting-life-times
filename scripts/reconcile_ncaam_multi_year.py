#!/usr/bin/env python3
"""Conservative multiple-prior-season athlete reconciliation.

Historical source IDs are not certified cross-season identifiers. Uses a globally
unique normalized name in the nearest prior season; ambiguity stays unresolved.
Previous college participation can be established for a missing-year player;
this does not establish present-season roster snapshot chronology.
"""
from collections import Counter
from reconcile_ncaam_players import reconcile

def reconcile_history(roster, prior_seasons):
    unresolved=list(roster)
    known={}
    status=Counter()
    evidence=[]
    # Process most recent first. Only carry forward unresolved players; this
    # avoids erroneously counting one person multiple times across seasons.
    for year,box in sorted(prior_seasons.items(),reverse=True):
        matched,counts,details=reconcile(unresolved,box)
        next_unresolved=[]
        lookup={(d['team'], ''.join(x for x in d['player'].upper() if x.isalnum())):d for d in details}
        for row in unresolved:
            from backtest_ncaam_quality_retrospective import school_key,player_key
            key=(school_key(row.get('team')),player_key(row.get('player')))
            detail=lookup.get(key)
            if detail and detail['matching_status'].startswith('matched'):
                if key not in known:
                    known[key]={'prior_year':year,'match_kind':detail['matching_status'],
                                'prior_school':detail['prior_school'],'prior_minutes':detail['prior_minutes']}
            else:next_unresolved.append(row)
        unresolved=next_unresolved
    from backtest_ncaam_quality_retrospective import school_key,player_key
    all_keys={(school_key(r.get('team')),player_key(r.get('player'))) for r in roster if school_key(r.get('team')) and player_key(r.get('player'))}
    assert len(known)<=len(all_keys)
    for key in all_keys:
        if key in known:status['matched_prior_college_history']+=1
        else:status['no_verified_history_in_available_seasons']+=1
    return known,dict(status)

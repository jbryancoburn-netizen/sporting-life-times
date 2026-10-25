#!/usr/bin/env python3
"""Conservative cross-season NCAA player reconciliation, with explicit reasons.

A source player_id is not assumed stable across seasons. Only use matching ID
with agreeing normalized name. Otherwise use globally unambiguous full name.
Players without preceding-season evidence remain ACCOUNTED FOR, not invented.
"""
from collections import defaultdict,Counter
from backtest_ncaam_quality_retrospective import player_key,school_key,number

def reconcile(roster, prior_box):
 by_name=defaultdict(lambda:defaultdict(list));by_id=defaultdict(lambda:defaultdict(list))
 for r in prior_box:
  name=player_key(r.get('player'));school=school_key(r.get('team'))
  mins=number(r.get('mins'))
  if not name or not school or not 0<mins<=70:continue
  by_name[name][school].append(r)
  pid=str(r.get('player_id') or '').strip()
  if pid:by_id[pid][name].append(r)
 seen=set();matches={};status=Counter();details=[]
 for r in roster:
  school=school_key(r.get('team'));name=player_key(r.get('player'))
  if not school or not name:continue
  key=(school,name)
  if key in seen:continue
  seen.add(key)
  pid=str(r.get('player_id') or '').strip()
  candidates=by_name.get(name,{})
  kind='unmatched_no_previous_box'
  records=[]
  if len(candidates)==1:
   records=next(iter(candidates.values()))
   kind='matched_unique_name'
   if pid and pid in by_id and name in by_id[pid] and len(by_id[pid])==1:
    kind='matched_name_and_source_id'
  elif len(candidates)>1:
   # A source ID matching both seasons and agreeing on full name can
   # disambiguate the prior school; never trust source ID in isolation.
   if pid and pid in by_id and set(by_id[pid])=={name}:
    rec=by_id[pid][name];schools={school_key(x.get('team')) for x in rec}
    if len(schools)==1:
     records=rec;kind='matched_name_and_source_id'
    else:kind='ambiguous_same_name_multiple_schools'
   else:kind='ambiguous_same_name_multiple_schools'
  if records:
   old_schools={school_key(x.get('team')) for x in records}
   if len(old_schools)!=1:raise AssertionError('nonunique prior school')
   old_school=next(iter(old_schools))
   # Same-school and transfers both accounted for.
   matches[key]=records
  else:old_school=None
  status[kind]+=1
  details.append({'team':school,'player':str(r.get('player')),'matching_status':kind,
                  'prior_school':old_school,'prior_rows':len(records),
                  'prior_minutes':sum(number(x.get('mins')) for x in records),
                  'current_source_player_id_present':bool(pid)})
 return matches,dict(status),details

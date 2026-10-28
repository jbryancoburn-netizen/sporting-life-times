#!/usr/bin/env python3
"""League-wide conservative site reconciliation from official school games and documented home venues."""
import json,pathlib,collections
base=pathlib.Path(__file__).resolve().parents[1]/'data'
cross=json.loads((base/'ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
arenas=json.loads((base/'mbb-arena-registry.json').read_text())['teams']
counts=collections.Counter();schools=[]
for t in cross:
 tid=str(t.get('espn_id',''))
 p=base/'mbb-schedules-2026-27'/(tid+'.json')
 if not p.exists():continue
 d=json.loads(p.read_text());changes=0
 for e in d.get('events',[]):
  counts['games_scanned']+=1
  c=(e.get('competitions') or [{}])[0];ps=c.get('competitors') or []
  own=next((x for x in ps if str((x.get('team') or {}).get('id'))==tid),None)
  opp=next((x for x in ps if x is not own),None)
  if not own or not opp:continue
  # Never infer game site merely from a home-city match: neutral sites and alternative facilities are possible.
  if e.get('site_verified') is True and own.get('homeAway') in ('home','away','neutral'):
   side=own['homeAway'];expected='away' if side=='home' else 'home' if side=='away' else 'neutral'
   if opp.get('homeAway')!=expected:opp['homeAway']=expected;changes+=1;counts['opponent_site_corrected']+=1
   neutral=side=='neutral'
   if e.get('neutralSite')!=neutral:e['neutralSite']=neutral;changes+=1;counts['neutral_flag_corrected']+=1
   if side in ('home','away'):
    host=tid if side=='home' else str((opp.get('team') or {}).get('id') or '')
    ar=arenas.get(host) or {}
    v=c.setdefault('venue',{})
    if not v.get('arenaName') and ar.get('home_arena') and not e.get('alternate_venue') and not e.get('neutralSite'):
     # Source-grounded default, clearly traceable; do not overwrite event-specific facility.
     v['arenaName']=ar['home_arena'];v['arena_source_url']=ar.get('home_arena_source')
     v['arena_source_type']='official_school_home_arena_default_not_game_specific'
     changes+=1;counts['venue_defaults_added']+=1
  else:counts['site_still_unverified']+=1
 if changes:
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
  counts['schools_modified']+=1
 schools.append({'school':t['name'],'changes':changes})
report={'summary':dict(counts),'method':'Fix inconsistent already-verified site flags; add traceable school home-arena defaults only to verified non-neutral games. Does not claim to verify unverified games.','schools':schools}
(base/'mbb-league-site-arena-reconciliation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['summary'],indent=2))

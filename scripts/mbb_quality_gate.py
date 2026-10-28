#!/usr/bin/env python3
"""League-wide pre-publication MBB QA. Report missing/contradictory metadata; do not invent it."""
import json,pathlib,collections,re
root=pathlib.Path(__file__).resolve().parents[1]
teams=[t for t in json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')]
brand=json.loads((root/'data/mbb-branding.json').read_text()).get('teams',{})
summary=collections.Counter();issues=[]
for t in teams:
 tid=str(t['espn_id']);path=root/'data/mbb-schedules-2026-27'/(tid+'.json')
 if not path.exists():issues.append({'school':t['name'],'problem':'schedule_file_missing'});summary['missing_files']+=1;continue
 d=json.loads(path.read_text());seen=set()
 for e in d.get('events',[]):
  summary['games_scanned']+=1
  c=(e.get('competitions') or [{}])[0];people=c.get('competitors') or []
  self=next((v for v in people if str((v.get('team') or {}).get('id'))==tid),{})
  opp=next((v for v in people if v is not self),{})
  opponent=(opp.get('team') or {})
  oid=str(opponent.get('id') or '')
  venue=c.get('venue') or {}
  date=str(e.get('date',''))[:10]
  key=(date,oid or (opponent.get('displayName') or e.get('name') or '').lower())
  problems=[]
  if key in seen:problems.append('duplicate_game')
  seen.add(key)
  if self.get('homeAway') not in ('home','away','neutral') or not e.get('site_verified'):problems.append('site_not_verified')
  if not venue.get('arenaName'):problems.append('arena_missing')
  if not (venue.get('address') or {}).get('city') and not venue.get('official_school_location'):problems.append('city_not_structured')
  if not oid:problems.append('opponent_id_missing')
  if not opponent.get('logo'):problems.append('logo_url_missing')
  if oid and oid not in brand:problems.append('logo_color_not_in_brand_registry')
  if not e.get('official_time'):problems.append('tipoff_unverified')
  if not (c.get('broadcasts') or e.get('broadcasts')):problems.append('broadcast_unverified')
  if problems:
   summary.update(problems)
   issues.append({'school':t['name'],'team_id':tid,'date':date,'opponent':opponent.get('displayName') or e.get('name'),'problems':problems})
summary['schools_scanned']=len(teams)
out={'generated_by':'scripts/mbb_quality_gate.py','summary':dict(summary),'game_issues':issues,'scope':'File-data quality only; image HTTP and browser layout require a separate live browser check'}
dest=root/'data/mbb-quality-gate-2026-27.json';dest.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'summary':dict(summary),'issue_rows':len(issues)},indent=2))

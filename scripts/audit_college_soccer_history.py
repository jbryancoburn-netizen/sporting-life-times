#!/usr/bin/env python3
"""Audit historical NCAA soccer opponent cohort and draw mix; never guess eligibility."""
import collections,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT/'data'/'college-soccer-history'
live=json.loads((ROOT/'data'/'college-soccer-elo.json').read_text())
current={x['team_id'] for x in live['cohorts']['men-d1']}
report={'status':'audit_pending_historical_membership_verification','current_d1_team_count':len(current),'years':{},'warnings':['Current 2026 Division I membership is not proof of 2023-2025 membership.','Out-of-cohort opponents may be former D-I, alternate slugs, or lower-division schools. Do not automatically discard.','Neutral and home-site labels remain unverified.']}
for year in (2023,2024,2025):
 d=json.loads((BASE/f'men-d1-{year}.json').read_text())
 if not d.get('coverage_complete') or len(d.get('checked_dates',[]))!=153 or d.get('errors'):
  raise ValueError(f'{year} is not fully collected')
 games=d['games'];outside=collections.Counter();draws=0;both=0;one=0;neither=0
 for g in games:
  h=g['home'] in current;a=g['away'] in current
  if h and a:both+=1
  elif h or a:one+=1
  else:neither+=1
  if not h:outside[g['home']]+=1
  if not a:outside[g['away']]+=1
  draws+=(g['home_goals']==g['away_goals'])
 report['years'][str(year)]={'games':len(games),'draws':draws,'draw_rate':round(draws/len(games),5),'both_teams_in_current_d1':both,'one_team_in_current_d1':one,'neither_team_in_current_d1':neither,'distinct_outside_current_d1':len(outside),'most_frequent_unmatched_team_slugs':[{'team_id':t,'appearances':n} for t,n in outside.most_common(40)]}
(BASE/'elo-cohort-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({y:{k:v for k,v in x.items() if k!='most_frequent_unmatched_team_slugs'} for y,x in report['years'].items()},indent=2))

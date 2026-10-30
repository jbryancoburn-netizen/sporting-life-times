#!/usr/bin/env python3
"""Apply official Patriot/Summit TV selections and the Patriot streaming rule.
Exclude the two unselected wildcard dates and every postseason/neutral fixture.
Streaming eligibility requires an explicit home row in the university evidence.
"""
import json,collections
import mbb_conference_schedule_recovery as r
import mbb_reconcile_saved_official_evidence as identity
PATRIOT='https://admin.patriotleague.org/news/2026/10/15/mens-basketball-patriot-league-announces-cbs-sports-network-basketball-schedule-for-2026-27-season.aspx'
SUMMIT='https://thesummitleague.org/news/2026/10/21/mens-basketball-summit-league-sets-2026-27-national-basketball-television-schedule-on-cbs-sports-network.aspx'
POLICY='https://patriotleague.org/sports/2020/9/15/GEN_0915200332.aspx?path=general'
WILDCARDS={'2027-02-21','2027-02-27'}
def selections():
 rows=[]
 for date,a,b,time in [('2026-11-11','Penn','Navy','5:30 p.m.'),('2027-01-11','American','Loyola Maryland','6:30 p.m.'),('2027-01-18','Boston University','Colgate','5 p.m.'),('2027-01-23','Navy','Army West Point','1:30 p.m.'),('2027-01-25','Colgate','Lehigh','6:30 p.m.'),('2027-02-01','Holy Cross','Lafayette','6:30 p.m.'),('2027-02-08','Lehigh','American','7 p.m.'),('2027-02-15','Boston University','Bucknell','6:30 p.m.'),('2027-02-20','Army West Point','Navy','1:30 p.m.')]:
  rows.append(dict(date=date,visitor=a,host=b,time=time,timezone='ET',tv='CBS Sports Network',relation='at',city='',source_url=PATRIOT))
 for date,a,b,time in [('2027-01-07','North Dakota State','St. Thomas','8 p.m.'),('2027-01-29','North Dakota State','North Dakota','9 p.m.'),('2027-01-31','South Dakota State','Omaha','2 p.m.'),('2027-02-06','Oral Roberts','South Dakota','2 p.m.'),('2027-02-13','South Dakota','South Dakota State','2 p.m.'),('2027-02-21','Kansas City','Omaha','2 p.m.'),('2027-02-21','Oral Roberts','St. Thomas','4 p.m.')]:
  rows.append(dict(date=date,visitor=a,host=b,time=time,timezone='ET',tv='CBS Sports Network',relation='at',city='',source_url=SUMMIT))
 return rows
def eligible(row,selected):
 return (row.get('site')=='home' and row.get('site_explicit') is True and not row.get('exhibition') and '2026-11-01'<=row['date']<='2027-02-27' and row['date'] not in WILDCARDS and row['date'] not in selected)
def main():
 r.ALIASES.update({'loyolamaryland':'2352','armywestpoint':'349','st.thomas':'2900'})
 rows=selections()
 registry=json.loads((r.DATA/'ncaam-2026-27-team-registry.json').read_text())['teams']
 ids={t['id'] for t in registry if t['conference']=='Patriot'}
 schools=[t for t in identity.m.TEAMS if t['id'] in ids]
 assert len(schools)==10
 for t in schools:
  tid=str(t['espn_id']);p=r.DATA/'mbb-official-game-evidence'/f'{tid}.json'
  if not p.exists():continue
  evidence=json.loads(p.read_text());dates={x['date'] for x in rows if r.team_id(x['host'])==tid or r.team_id(x['visitor'])==tid}
  counts=collections.Counter(x['date'] for x in evidence['rows'])
  for row in evidence['rows']:
   if not eligible(row,dates) or counts[row['date']]!=1:continue
   oid=identity.resolve(row['opponent'])
   if not oid or oid==tid:continue
   rows.append(dict(date=row['date'],visitor=identity.byid[oid]['name'],host=t['name'],time='',tv='ESPN+',relation='at',city='',source_url=POLICY,fixture_source_url=evidence['source_url'],broadcast_evidence_method='explicit_league_home_streaming_rule_excluding_CBSSN_and_wildcards'))
 r.EVIDENCE=r.DATA/'mbb-patriot-summit-game-evidence.json';r.REPORT=r.DATA/'mbb-patriot-summit-recovery.json'
 r.recover({'season':'2026-27','rows':rows,'excluded_wildcard_dates':sorted(WILDCARDS)})
if __name__=='__main__':main()

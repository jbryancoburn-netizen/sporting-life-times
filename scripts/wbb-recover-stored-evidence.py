#!/usr/bin/env python3
"""Recover exact date/opponent matches from already captured official women's rows.
No game identities, sites, times, venues or networks are changed. Ambiguous school
names and tournament alternatives remain unresolved. School names are identity
metadata only; men's results and schedules are never evidence for women's games.
"""
import collections,datetime,json,pathlib,re,ast
from zoneinfo import ZoneInfo
from functools import lru_cache
@lru_cache(maxsize=4096)
def name_pattern(label):return re.compile(r"(?<![a-z0-9])"+re.escape(label)+r"(?![a-z0-9])")
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
def read(name):return json.loads((DATA/name).read_text())
def norm(s):
 s=re.sub(r"\b(university|college|the)\b",' ',str(s).casefold())
 return ' '.join(re.sub(r'[^a-z0-9]+',' ',s).split())
def identity(text,aliases,own):
 if re.search(r'\b(or|tba|tbd|winner|loser|semifinal|championship)\b',text,re.I):return None
 text=norm(text);found=[]
 for label,ids in aliases.items():
  if name_pattern(label).search(text):found.append((label,ids))
 # A shorter school's name embedded in a longer school's identity is not a
 # second school. Kansas State must never match Kansas; Western Kentucky
 # must never match Kentucky. Independent names elsewhere stay ambiguous.
 found=[(label,ids) for label,ids in found if not any(label!=other and name_pattern(label).search(other) for other,_ in found)]
 ids=set().union(*(ids for _,ids in found)) if found else set()
 ids.discard(own)
 return next(iter(ids)) if len(ids)==1 else None

def main():
 master=read('ncaaw-schedules-2026-27.json');bulk=read('ncaaw-2026-27-official-schedule-bulk-audit.json');evidence=read('ncaaw-2026-27-official-schedule-bulk-evidence.json')
 assert master['gender']=='women' and master['season']=='2026-27' and len(master['teams'])==363
 aliases=collections.defaultdict(set)
 cross=read('ncaam-2026-27-espn-team-crosswalk.json')['teams']
 parsed=ast.parse((ROOT/'scripts/wbb-verify-official-schools.py').read_text())
 official=next(ast.literal_eval(n.value) for n in parsed.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='OFFICIAL_NAME_ALIASES' for t in n.targets))
 for t in cross:
  tid=str(t['espn_id'])
  if tid not in master['teams']:continue
  names=[t['name'],master['teams'][tid]['team'],*official.get(tid,())]
  if t['name'].endswith(' St.') and ' State ' in t['espn_name']:names.append(t['name'][:-4]+' State')
  for name in names:
   label=norm(name)
   if len(label)>=3:aliases[label].add(tid)
 # Literal abbreviation used by official university schedules.
 for tid,names in {'2115':['Central Connecticut State','Central Connecticut'],'399':['Albany'],'2433':['UL Monroe','Louisiana Monroe'],'2443':['New Orleans','LSU New Orleans'],'2390':['Miami FL','Miami Florida']}.items():
  for name in names:aliases[norm(name)].add(tid)
 for tid,t in read('ncaaw-school-identities-2026-27.json')['teams'].items():
  if tid in master['teams']:
   for name in t.values():
    if name and len(norm(name))>=3:aliases[norm(name)].add(tid)
 # Non-Division I opponents also need unambiguous school identities. A
 # shortened name is accepted only when its prefix is unique among EVERY
 # published opponent/program, including the Division I registry.
 prefixes=collections.defaultdict(set)
 for tid,t in master['teams'].items():
  for name,oid in [(t['team'],tid)]+[(g['opponent'],str(g['opponent_id'])) for g in t['games']]:
   words=norm(name).split()
   for n in (1,2,3):
    if len(words)>=n:
     label=' '.join(words[:n])
     if len(label)>=4:prefixes[label].add(oid)
 for label,ids in prefixes.items():
  if len(ids)==1 and next(iter(ids)) not in master['teams'] and label not in aliases:aliases[label]=ids
 for text,expected in [('Kansas State Wildcats','2306'),('Western Kentucky Hilltoppers','98'),('Arkansas Razorbacks','8'),('Kansas or Kansas State',None)]:
  assert identity(text,aliases,'84')==expected,(text,identity(text,aliases,'84'))
 stored={(str(r['team_id']),str(r['game_id'])):r for r in evidence['rows']}
 recovered=[]
 for school in bulk['school_results']:
  tid=str(school['team_id']);url=school.get('source') or ''
  if not url.startswith('https://'):continue
  bydate=collections.defaultdict(list)
  for g in master['teams'][tid]['games']:
   day=datetime.datetime.fromisoformat(g['date'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date().isoformat();bydate[day].append(g)
  for row in school.get('unmatched_official_rows',[]):
   if row.get('reason')!='no_unique_existing_game_match':continue
   opp=identity(row.get('opponent',''),aliases,tid)
   candidates=[g for g in bydate[row['date']] if str(g['opponent_id'])==opp]
   if len(candidates)!=1:continue
   g=candidates[0];key=(tid,str(g['id']))
   if key in stored:continue
   e={'team_id':tid,'game_id':str(g['id']),'verified_date':row['date'],'verified_opponent':row['opponent'],'verified_fields':['scheduled_date','opponent'],'source_url':url,'source_type':'stored_official_womens_schedule_row_exact_identity','source_capture_file':'data/ncaaw-2026-27-official-schedule-bulk-audit.json'}
   stored[key]=e;recovered.append(e)
   if not g.get('official_schedule_source_url'):
    g['official_schedule_source_url']=url;g['official_schedule_source_type']=e['source_type'];g['official_schedule_verified_fields']=e['verified_fields']
 # An exact opponent-university listing proves the same existing matchup
 # on both calendars. Label this separately from the school's own evidence.
 bygame=collections.defaultdict(list)
 for key,row in stored.items():bygame[key[1]].append(row)
 reciprocal=[]
 for tid,t in master['teams'].items():
  for g in t['games']:
   key=(tid,str(g['id']))
   if key in stored:continue
   day=datetime.datetime.fromisoformat(g['date'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date().isoformat()
   candidates=[r for r in bygame[key[1]] if str(r['team_id'])==str(g['opponent_id']) and r.get('verified_date')==day and str(r.get('source_url','')).startswith('https://')]
   if len(candidates)!=1:continue
   source=candidates[0]
   row={'team_id':tid,'game_id':key[1],'verified_date':day,'verified_opponent':g['opponent'],'verified_fields':['scheduled_date','opponent'],'source_url':source['source_url'],'source_type':'reciprocal_opponent_university_date_opponent_evidence','source_team_id':source['team_id'],'source_opponent_as_printed':source['verified_opponent'],'verification_scope':'opponent_university_not_own_school'}
   stored[key]=row;reciprocal.append(row)
   if not g.get('official_schedule_source_url'):
    g['official_schedule_source_url']=row['source_url'];g['official_schedule_source_type']=row['source_type'];g['official_schedule_verified_fields']=row['verified_fields']
 evidence['rows']=list(stored.values())
 counts=collections.Counter(tid for tid,_ in stored)
 for school in bulk['school_results']:
  tid=str(school['team_id']);school.setdefault('last_live_scan_matched',school['matched']);school['matched']=counts[tid];school['retained_and_recovered_evidence_rows']=counts[tid]
 bulk.update(verified_team_game_rows_including_prior=len(stored),verified_unique_game_ids=len({gid for _,gid in stored}),verified_school_count_including_prior=len(counts),stored_source_rows_recovered=sum(r.get('source_type')=='stored_official_womens_schedule_row_exact_identity' for r in stored.values()))
 total=sum(len(t['games']) for t in master['teams'].values())
 report={'season':'2026-27','gender':'women','programs':363,'team_game_entries':total,'official_date_opponent_evidence_rows':len(stored),'newly_recovered_rows':len(recovered),'stored_source_rows_recovered_total':sum(r.get('source_type')=='stored_official_womens_schedule_row_exact_identity' for r in stored.values()),'reciprocal_source_rows':sum(r.get('verification_scope')=='opponent_university_not_own_school' for r in stored.values()),'unmatched_team_game_entries':total-len(stored),'schools_fully_matched':sum(counts[tid]==len(t['games']) for tid,t in master['teams'].items()),'live_refresh_status':'318 of 363 school pages readable on 2026-11-01; prior evidence retained','policy':'Only existing game IDs, exact local dates and uniquely identified schools matched. No site/time/arena/broadcast inferred. Stored evidence is not a fresh university recertification.','recovered_rows':[r for r in stored.values() if r.get('source_type')=='stored_official_womens_schedule_row_exact_identity'],'reciprocal_rows':[r for r in stored.values() if r.get('verification_scope')=='opponent_university_not_own_school']}
 for file,obj in [('ncaaw-schedules-2026-27.json',master),('ncaaw-2026-27-official-schedule-bulk-evidence.json',evidence),('ncaaw-2026-27-official-schedule-bulk-audit.json',bulk),('ncaaw-2026-27-stored-evidence-recovery-audit.json',report)]:
  (DATA/file).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k not in ('recovered_rows','reciprocal_rows')},indent=2))
if __name__=='__main__':main()

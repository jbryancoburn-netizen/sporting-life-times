#!/usr/bin/env python3
"""First 100 MBB schools: normalize known arena and city strings, no guessed locations."""
import json,re,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1]
teams=[t for t in json.loads((root/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams'] if t.get('espn_id')][:100]
assert len(teams)==100
city_state=re.compile(r"^(.+?),\s*((?:[A-Z]{2})|(?:Ohio|Florida|Texas|California|New York|Pennsylvania|Indiana|Georgia|Virginia|Maryland|Kentucky|Tennessee|Louisiana|Illinois|Michigan|Alabama|Colorado|Arizona|Arkansas|North Carolina|South Carolina|Iowa|Utah|Wisconsin|New Jersey|Missouri|Oregon|Washington|Nevada|Mississippi|Kansas|Connecticut|Oklahoma|Minnesota|Massachusetts|Nebraska|Idaho|New Mexico|West Virginia|Rhode Island|Delaware|Montana|Maine|Alaska|Hawaii|Wyoming|Vermont|North Dakota|South Dakota))\b",re.I)
report=[]
for t in teams:
 p=root/'data/mbb-schedules-2026-27'/(str(t['espn_id'])+'.json')
 if not p.exists():
  report.append({'team':t['name'],'status':'missing_file'});continue
 data=json.loads(p.read_text());stats=collections.Counter()
 for e in data.get('events',[]):
  c=(e.get('competitions') or [{}])[0];v=c.get('venue') or {};raw=str(v.get('fullName') or '').strip()
  if not raw:stats['missing_venue']+=1;continue
  if re.search(r'Choose A Location|All Games Home|Select Location',raw,re.I):
   c.pop('venue',None);stats['removed_filter_text']+=1;continue
  # University schedules often use "City, ST (Arena Name)"; preserve the raw field for traceability.
  m=re.match(r'^(.+?)\s*\(([^()]+)\)\s*$',raw)
  location=m.group(1).strip() if m else raw
  parenthetical=m.group(2).strip() if m else ''
  address=v.get('address') or {}
  loc=city_state.match(location)
  if loc and not address.get('city'):
   city=loc.group(1).strip(); state=loc.group(2).strip()
   if city and len(city)<70:
    v['address']={**address,'city':city,'state':state}
    stats['city_state_added']+=1
  # Parentheticals only treated as an arena if recognizable as a facility name.
  if parenthetical and re.search(r'Arena|Center|Centre|Coliseum|Gymnasium|Fieldhouse|Pavilion|Forum|Convocation|Stadium|Dome|Auditorium',parenthetical,re.I):
   if v.get('arenaName')!=parenthetical:
    v['arenaName']=parenthetical;stats['arena_name_added']+=1
  elif loc and not v.get('arenaName'):
   stats['city_only_no_arena']+=1
  c['venue']=v
 if stats['city_state_added'] or stats['arena_name_added'] or stats['removed_filter_text']:
  data['location_normalization']={'method':'parsed explicit city/state and facility name from original schedule venue strings; no inferred home court','version':'2026-10-27'}
  p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 report.append({'team':t['name'],'id':t['espn_id'],'games':len(data.get('events',[])),**stats})
out={'schools_processed':len(report),'files_missing':sum(r.get('status')=='missing_file' for r in report),'files_modified':sum(r.get('city_state_added',0)+r.get('arena_name_added',0)+r.get('removed_filter_text',0)>0 for r in report),'totals':{k:sum(r.get(k,0) for r in report) for k in ['city_state_added','arena_name_added','city_only_no_arena','missing_venue','removed_filter_text']},'method':'Parse only explicit locations from existing source strings; not external source verification.','schools':report}
(root/'data/mbb-first-100-arena-city-recovery-20261027.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='schools'},indent=2))

#!/usr/bin/env python3
"""Recover shorthand opponent IDs only with a unique reciprocal official fixture."""
import json,re,pathlib,collections,importlib.util
sp=importlib.util.spec_from_file_location('identity',pathlib.Path(__file__).with_name('mbb_reconcile_saved_official_evidence.py'));identity=importlib.util.module_from_spec(sp);sp.loader.exec_module(identity);m=identity.m
fixtures=collections.defaultdict(list);byid=identity.byid
for school in m.TEAMS:
 tid=str(school['espn_id']);p=m.DATA/'mbb-official-game-evidence'/(tid+'.json')
 if not p.exists():continue
 facts=json.loads(p.read_text())
 for r in facts['rows']:
  oid=r.get('opponent_id') or identity.resolve(r['opponent'])
  if oid and oid!=tid and not r.get('exhibition'):fixtures[(r['date'],oid)].append((tid,r,facts['source_url']))
def related(label,tid):
 key=identity.schoolkey(label)
 if not key:return False
 if tid in identity.exact.get(m.norm(label),set()) or tid in identity.index.get(key,set()):return True
 names=[text for text,ids in identity.index.items() if tid in ids]
 if len(key)>=4 and any(text.startswith(key) or len(text)>=5 and key.startswith(text) for text in names):return True
 # Institution initials are only candidate hints. The exact date and the
 # independently published opposing-school fixture remain mandatory.
 raw=re.sub('[^A-Za-z]','',label)
 if label.upper()==label and 2<=len(raw)<=5:
  title=re.sub(r'\([^)]*\)','',byid[tid]['name'])
  words=re.findall(r'[A-Za-z]+',title)
  initials=''.join(w[0].upper() for w in words if w.lower() not in ('of','the','at'))
  if raw in (initials,initials+'U'):return True
 return False
changes=[];counts=collections.Counter()
for school in m.TEAMS:
 tid=str(school['espn_id']);p=m.DATA/'mbb-schedules-2026-27'/(tid+'.json');d=json.loads(p.read_text());dirty=False
 for e in d['events']:
  ps=e['competitions'][0]['competitors'];own=next((x for x in ps if str(x.get('team',{}).get('id'))==tid),None)
  if own is None:continue
  other=next((x for x in ps if x is not own),{});team=other.get('team',{})
  if team.get('id'):continue
  label=team.get('displayName') or e.get('name','')
  candidates=[x for x in fixtures.get((e['date'][:10],tid),[]) if related(label,x[0])]
  unique={x[0] for x in candidates}
  if len(unique)!=1:continue
  oid=next(iter(unique));proof=next(x for x in candidates if x[0]==oid)
  team.update(id=oid,displayName=byid[oid].get('espn_name') or byid[oid]['name']);e['official_opponent_identity_source']=proof[2]
  e['official_opponent_identity_method']='unique_reciprocal_official_date_and_school_alias'
  changes.append({'school':school['name'],'id':tid,'date':e['date'][:10],'old_label':label,'opponent_id':oid,'opponent':byid[oid]['name'],'source_url':proof[2]});dirty=True
 if dirty:p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n');counts['schools_updated']+=1
report={'summary':{**dict(counts),'opponent_ids_recovered':len(changes)},'changes':changes}
(m.DATA/'mbb-reciprocal-opponent-identity-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary']))

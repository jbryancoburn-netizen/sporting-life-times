#!/usr/bin/env python3
"""Repair clocks contaminated by mobile TV/radio/date labels.
Only explicit clock strings from fresh official pages can replace bad values.
Bad values without a safely matched clock become unresolved, never noon guesses.
"""
import collections,datetime,json,pathlib,re,sys
import mbb_deep_official_recovery as deep
import mbb_reconcile_saved_official_evidence as identities
BAD=re.compile(r'^(?:Jan|Feb|Mar|Apr|Oct|Nov|Dec)\s+\d|ESPN|Network|\bFM\b|\bKISU\b|\bHSRN\b|SWAC|WXSM|WEIU|WFUV|Sports Ticket|PAC 12|^Peacock$|^YouTube$|^CBSSN$|^SECN\+?$|^ACCNX?$|^truTV$|^MASN/',re.I)
def invalid(value):return bool(BAD.search(value or ''))
def main(cache):
 changes=[];schools=set();evidence_updates=0
 for tid,t in deep.TEAM.items():
  p=deep.D/'mbb-schedules-2026-27'/f'{tid}.json';d=json.loads(p.read_text());fp=cache/f'{tid}.json'
  fresh=json.loads(fp.read_text()) if fp.exists() else {'rows':[],'url':''}
  rows=fresh['rows'];url=fresh['url'];changed=False
  for e in d['events']:
   old=e.get('official_school_time','')
   if not invalid(old):continue
   names=deep.aliases(e,tid);ps=e['competitions'][0]['competitors'];opp=next((x for x in ps if str(x['team'].get('id'))!=tid),{});oid=str(opp.get('team',{}).get('id') or '')
   matches=[r for r in rows if r['date']==e['date'][:10] and (deep.parser.norm(r['opponent']) in names or (oid and identities.resolve(r['opponent'])==oid))]
   new=matches[0].get('time','') if len(matches)==1 else ''
   if not deep.TIME.fullmatch(new):new=''
   changes.append({'school':t['name'],'id':tid,'event_id':e.get('id'),'date':e['date'][:10],'old_value':old,'new_value':new or None,'source_url':url or e.get('official_school_time_source'),'status':'corrected' if new else 'invalid_value_removed_unresolved'})
   if new:e['official_school_time']=new;e['official_school_time_source']=url
   else:e.pop('official_school_time',None);e.pop('official_school_time_source',None)
   changed=True
  if changed:p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n');schools.add(tid)
  # Prevent cached official evidence from putting a contaminated value back.
  ep=deep.D/'mbb-official-game-evidence'/f'{tid}.json'
  if ep.exists():
   evidence=json.loads(ep.read_text());dirty=False
   for row in evidence['rows']:
    if not invalid(row.get('time','')):continue
    matches=[r for r in rows if r['date']==row['date'] and deep.parser.norm(r['opponent'])==deep.parser.norm(row['opponent'])]
    new=matches[0].get('time','') if len(matches)==1 else ''
    row['time']=new if deep.TIME.fullmatch(new) else '';dirty=True;evidence_updates+=1
   if dirty:ep.write_text(json.dumps(evidence,ensure_ascii=False,separators=(',',':'))+'\n')
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':{'schools_changed':len(schools),'corrected_tipoffs':sum(c['status']=='corrected' for c in changes),'invalid_values_removed_unresolved':sum(c['status']!='corrected' for c in changes),'cached_evidence_rows_repaired':evidence_updates},'changes':changes}
 (deep.D/'mbb-tipoff-repair-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report['summary']))
if __name__=='__main__':main(pathlib.Path(sys.argv[1]))

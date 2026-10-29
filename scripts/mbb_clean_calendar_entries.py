#!/usr/bin/env python3
"""Remove provably non-game rows while retaining their source records for review."""
import json,re,pathlib,collections,importlib.util,datetime
sp=importlib.util.spec_from_file_location('identity',pathlib.Path(__file__).with_name('mbb_reconcile_saved_official_evidence.py'));identity=importlib.util.module_from_spec(sp);sp.loader.exec_module(identity);m=identity.m
PROMOTION=re.compile(r'presented by|homecoming|toy drive|\bnight\b|home opener|winter wonderland|salute to|\bday\b|reunion|\bDunesday\b|doubleheader|\bappreciation\b|walk to end|coaches vs.? cancer',re.I)
ROUND=re.compile(r'\b(?:quarterfinals?|semifinals?|sweet 16|elite eight|final four|first round|second round|third round|opening round|championships?|tournament)\b',re.I)
def other_of(e,tid):return next((x for x in e['competitions'][0]['competitors'] if str(x.get('team',{}).get('id'))!=tid),{})
def label_of(e,tid):return other_of(e,tid).get('team',{}).get('displayName') or e.get('name','')
def main():
 report_path=m.DATA/'mbb-non-game-entry-audit.json'
 previous=json.loads(report_path.read_text()) if report_path.exists() else {}
 quarantine=[];stats=collections.Counter();changed=[]
 for t in m.TEAMS:
  tid=str(t['espn_id']);path=m.DATA/'mbb-schedules-2026-27'/(tid+'.json');doc=json.loads(path.read_text());kept=[];local=collections.Counter()
  for event in doc['events']:
   other=other_of(event,tid).get('team',{});label=label_of(event,tid);day=event['date'][:10];reason='';proof=[]
   real=[e for e in doc['events'] if e['id']!=event['id'] and e['date'][:10]==day and (other_of(e,tid).get('team',{}).get('id') or re.search(r'\b(?:College|University|Academy|Institute)\b',label_of(e,tid),re.I)) and not PROMOTION.search(label_of(e,tid))]
   if not other.get('id') and PROMOTION.search(label) and real:
    reason='promotional label imported as a separate opponent';proof=[e['id'] for e in real]
   # A schedule may list other games in a hosted tournament. Both named clubs
   # must resolve and neither may be the owner of this team page.
   if not reason and not other.get('id'):
    parts=re.split(r'\s+vs\.?\s+',label,flags=re.I)
    if len(parts)==2:
     pair=[identity.resolve(x) for x in parts]
     if all(pair) and tid not in pair:reason='hosted tournament fixture does not involve this team';proof=pair
   # Unearned March/April rounds are retained in the audit, not as confirmed games.
   if not reason and not other.get('id') and day>='2027-03-01' and ROUND.search(label):
    reason='conditional postseason round has no named confirmed opponent'
   if reason:
    quarantine.append({'school':t['name'],'id':tid,'reason':reason,'source_url':event.get('school_source_url') or doc.get('source_url'),'corroborating_records':proof,'record':event});local[reason]+=1
   else:
    if not other.get('displayName') and str(other.get('id')) in identity.byid:
     school=identity.byid[str(other['id'])];other['displayName']=school.get('espn_name') or school['name'];local['missing_opponent_names_restored']+=1
    kept.append(event)
  if local:
   doc['events']=kept;path.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':'))+'\n');changed.append(t['name']);stats.update(local)
 all_records={(x['id'],x['record']['id']):x for x in previous.get('quarantined_records',[])}
 for x in quarantine:all_records[(x['id'],x['record']['id'])]=x
 cumulative=collections.Counter(x['reason'] for x in all_records.values())
 cumulative['missing_opponent_names_restored']=previous.get('summary',{}).get('missing_opponent_names_restored',0)+stats.get('missing_opponent_names_restored',0)
 all_schools=sorted(set(previous.get('schools_updated',[]))|set(changed))
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':{'schools_updated':len(all_schools),'records_quarantined':len(all_records),**dict(cumulative)},'schools_updated':all_schools,'quarantined_records':list(all_records.values())}
 report_path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['summary']))

if __name__=='__main__':main()

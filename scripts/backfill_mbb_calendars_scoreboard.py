#!/usr/bin/env python3
"""Backfill 2026–27 MBB calendars from daily national scoreboard snapshots.

Runs once per date, then allocates each verified fixture to both schools.
Never replaces a complete official-athletics calendar with an incomplete feed.
"""
import concurrent.futures,datetime,json,pathlib,urllib.request,collections,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
TEAMS=json.loads((ROOT/'data/ncaam-2026-27-espn-team-crosswalk.json').read_text())['teams']
OUT=ROOT/'data/mbb-schedules-2026-27'
OUT.mkdir(parents=True,exist_ok=True)
known={str(t['espn_id']):t for t in TEAMS}
start=datetime.date(2026,11,2)
end=datetime.date(2027,3,15)
days=[start+datetime.timedelta(days=i) for i in range((end-start).days+1)]
def dayfetch(day):
 q=day.strftime('%Y%m%d')
 endpoint=f'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&limit=1000&dates={q}'
 try:
  req=urllib.request.Request(endpoint,headers={'User-Agent':'Mozilla/5.0 SportingLifeTimes/1.0','Accept':'application/json'})
  with urllib.request.urlopen(req,timeout=25) as r: data=json.load(r)
  return q,(data.get('events') or []),None
 except Exception as e:return q,[],str(e)[:150]
by_team=collections.defaultdict(dict)
raw_games=0
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for date,events,err in pool.map(dayfetch,days):
  if err:errors.append({'date':date,'error':err});continue
  for event in events:
   if not event.get('id') or not str(event.get('date',''))[:4] in ('2026','2027'):continue
   participants=event.get('competitions',[{}])[0].get('competitors',[])
   matched=[str(x.get('team',{}).get('id','')) for x in participants if str(x.get('team',{}).get('id','')) in known]
   if not matched:continue
   raw_games+=1
   for eid in matched:by_team[eid][str(event['id'])]=event
summary={'as_of':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dates_queried':len(days),'days_with_errors':len(errors),'errors':errors[:30],'games_matching_school':raw_games,'schools_with_games_in_source':len(by_team),'schools_updated':0,'schools_preserved':0,'schools_awaiting_source':0,'minimum_games':0,'maximum_games':0}
counts=[]
for eid,team in known.items():
 path=OUT/(eid+'.json')
 rows=list(by_team[eid].values())
 rows.sort(key=lambda e:e.get('date',''))
 existing={}
 if path.exists():
  try: existing=json.loads(path.read_text())
  except (ValueError,OSError):pass
 old=existing.get('events',[])
 if existing.get('source_name')=='Indiana University Athletics official 2026-27 schedule' or len(old)>len(rows):
  summary['schools_preserved']+=1
  if old:counts.append(len(old))
  continue
 if not rows:
  summary['schools_awaiting_source']+=1
  continue
 payload={'season':'2026-27','team_id':team['id'],'espn_team_id':eid,'source_name':'ESPN 2026–27 daily national scoreboard','fetched_at':summary['as_of'],'events':rows}
 path.write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=False)+'\n')
 summary['schools_updated']+=1
 counts.append(len(rows))
summary['minimum_games']=min(counts) if counts else 0
summary['maximum_games']=max(counts) if counts else 0
(OUT/'scoreboard-backfill-status.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in summary.items()},indent=2))
if summary['schools_updated']<50:
 raise SystemExit('Insufficient scoreboard coverage; refusing to claim national schedule backfill completed')

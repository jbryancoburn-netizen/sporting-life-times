#!/usr/bin/env python3
"""Import complete NCAA men's D-I basketball seasons from ESPN scoreboard by calendar day.
Produces independently auditable input for RETRO. Runs only for 2024-25 and 2025-26.
"""
import json,urllib.request,datetime,time,sys,pathlib
year=int(sys.argv[1]) if len(sys.argv)>1 else 2026
if year not in (2025,2026): raise SystemExit('Season ending year must be 2025 or 2026')
start=datetime.date(year-1,11,1);end=datetime.date(year,4,15)
games={};fail=[]
day=start
while day<=end:
 url='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates='+day.strftime('%Y%m%d')+'&groups=50&limit=500'
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'SportingLifeTimes-Research/1.0'})
  with urllib.request.urlopen(req,timeout=30) as res: data=json.load(res)
  for event in data.get('events',[]):
   if not event.get('status',{}).get('type',{}).get('completed'):continue
   competition=(event.get('competitions') or [{}])[0]
   sides=competition.get('competitors') or []
   if len(sides)!=2:continue
   home=next((x for x in sides if x.get('homeAway')=='home'),None)
   away=next((x for x in sides if x.get('homeAway')=='away'),None)
   if not home or not away:continue
   try:hs=int(home['score']);aws=int(away['score'])
   except (ValueError,TypeError,KeyError):continue
   if not home.get('team',{}).get('id') or not away.get('team',{}).get('id'):continue
   gid=str(event['id'])
   games[gid]={'id':gid,'date':event.get('date'),'home_id':str(home['team']['id']),'away_id':str(away['team']['id']),'home':home['team'].get('displayName'),'away':away['team'].get('displayName'),'home_score':hs,'away_score':aws,'site':'neutral' if competition.get('neutralSite') else 'home','season':year}
 except Exception as exc:fail.append({'date':str(day),'error':str(exc)})
 day+=datetime.timedelta(days=1)
 time.sleep(.07)
out={'season':f'{year-1}-{str(year)[-2:]}','games':sorted(games.values(),key=lambda x:(x['date'] or '',x['id'])),'audit':{'days_failed':fail,'game_count':len(games),'complete':not fail,'first_day':str(start),'last_day':str(end)}}
pathlib.Path('data').mkdir(exist_ok=True)
path=pathlib.Path(f'data/mbb-{year-1}-{year}-results.json')
path.write_text(json.dumps(out,separators=(',',':')))
print(path,'games',len(games),'failed days',len(fail))
if fail or len(games)<4000:raise SystemExit('Historical season failed completeness checks')

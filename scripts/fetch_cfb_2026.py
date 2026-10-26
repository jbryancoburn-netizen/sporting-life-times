#!/usr/bin/env python3
"""Fetch and audit 2026 college-football results from ESPN only."""
import datetime,json,pathlib,urllib.request,collections
BASE="https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard"
today=datetime.datetime.now(datetime.timezone.utc).date()
season=2026
games={}
errors=[]
sources=[("week "+str(w),f"?dates=2026&seasontype=2&week={w}&groups=80&limit=400") for w in range(18)]
sources += [("opening "+d,f"?dates={d}&groups=80&limit=400") for d in ("20260829","20260830","20260831")]
for label,query in sources:
 try:
  req=urllib.request.Request(BASE+query,headers={"User-Agent":"SportingLifeTimes/1.0"})
  with urllib.request.urlopen(req,timeout=18) as response: events=json.load(response).get("events",[])
  for event in events:
   if not event.get("status",{}).get("type",{}).get("completed"): continue
   sides=event.get("competitions",[{}])[0].get("competitors",[])
   if len(sides)!=2 or any(not x.get("team",{}).get("id") or x.get("score") is None for x in sides):continue
   eid=str(event["id"])
   game={"id":eid,"date":event["date"],"teams":[{"id":str(s["team"]["id"]),"name":s["team"].get("displayName"),"score":int(s["score"]),"homeAway":s.get("homeAway")} for s in sides],"neutral":event["competitions"][0].get("neutralSite",False)}
   if eid in games and games[eid]!=game:errors.append("Conflicting game "+eid)
   games[eid]=game
 except Exception as e:errors.append(label+": "+str(e))
ordered=sorted(games.values(),key=lambda g:(g["date"],g["id"]))
report={"season":season,"baseline":1500,"source":"ESPN completed-game scoreboards","generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"games":len(ordered),"first_game":ordered[0]["date"] if ordered else None,"last_game":ordered[-1]["date"] if ordered else None,"errors":errors,"complete":not errors and bool(ordered)}
out=pathlib.Path("data");out.mkdir(exist_ok=True)
(out/"cfb-2026-results.json").write_text(json.dumps({"audit":report,"games":ordered},indent=2)+"\n")
print(json.dumps(report,indent=2))
if errors or not ordered:raise SystemExit("ESPN import incomplete; inspect errors")

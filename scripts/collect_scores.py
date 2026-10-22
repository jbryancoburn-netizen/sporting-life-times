#!/usr/bin/env python3
"""Fetch attributed public ESPN scoreboards. Never manufacture scores or statuses."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
LEAGUES=[("NFL","football/nfl"),("MLB","baseball/mlb"),("NBA","basketball/nba"),("NHL","hockey/nhl"),("Premier League","soccer/eng.1"),("College Football","football/college-football"),("Men's College Basketball","basketball/mens-college-basketball"),("Women's College Basketball","basketball/womens-college-basketball")]
out={"updated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"source":"ESPN public scoreboard API","leagues":[]}
for label,path in LEAGUES:
    url="https://site.api.espn.com/apis/site/v2/sports/"+path+"/scoreboard"
    block={"league":label,"source_url":"https://www.espn.com/"+path+"/scoreboard","games":[],"error":None}
    logo_by_id={}
    try:
        team_req=Request("https://site.api.espn.com/apis/site/v2/sports/"+path+"/teams?limit=500",headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
        with urlopen(team_req,timeout=12) as response: team_data=json.load(response)
        for sport in team_data.get("sports",[]):
            for league in sport.get("leagues",[]):
                for item in league.get("teams",[]):
                    team=item.get("team") or {}
                    logo=next((x.get("href") for x in team.get("logos",[]) if x.get("href","").startswith("https://")),None)
                    if logo: logo_by_id[str(team.get("id"))]=logo
    except Exception:
        pass
    try:
        req=Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
        with urlopen(req,timeout=12) as response: data=json.load(response)
        for ev in data.get("events",[])[:35]:
            comp=(ev.get("competitions") or [{}])[0]
            competitors=comp.get("competitors",[])
            teams=[]
            for c in competitors:
                t=c.get("team") or {}
                teams.append({"name":t.get("displayName") or t.get("name") or "Unknown","score":c.get("score"),"home_away":c.get("homeAway"),"winner":c.get("winner"),"logo":next((x.get("href") for x in (t.get("logos") or []) if x.get("href","").startswith("https://")),None) or logo_by_id.get(str(t.get("id")))})
            status=ev.get("status") or {}
            block["games"].append({"id":str(ev.get("id","")),"name":ev.get("name",""),"date":ev.get("date",""),"status":(status.get("type") or {}).get("description","Unknown"),"state":(status.get("type") or {}).get("state",""),"teams":teams,"url":((comp.get("links") or ev.get("links") or [{}])[0]).get("href",block["source_url"])})
    except Exception as exc: block["error"]=type(exc).__name__+": "+str(exc)[:100]
    out["leagues"].append(block)
(ROOT/"scoreboards.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Fetched",sum(len(x["games"]) for x in out["leagues"]),"games across",len(LEAGUES),"leagues")

#!/usr/bin/env python3
"""Independent official-league scoreboard adapters; no fabricated game records."""
import json
from datetime import datetime,timezone,timedelta
from urllib.request import Request,urlopen
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def fetch(url):
    req=Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
    with urlopen(req,timeout=15) as r:return json.load(r)
def state(value):
    s=str(value or "").lower()
    if s in ("final","game over","official","completed","off"):return "post"
    if s in ("live","in progress","inprogress","critical","preview-live"):return "in"
    return "pre"
def mlb(day):
    date=day.isoformat()
    url="https://statsapi.mlb.com/api/v1/schedule?sportId=1&date="+date+"&hydrate=linescore"
    data=fetch(url);games=[]
    for block in data.get("dates",[]):
        for g in block.get("games",[]):
            sides=g.get("teams",{})
            teams=[]
            for side in ("away","home"):
                item=sides.get(side,{})
                team=item.get("team",{})
                teams.append({"name":team.get("name","Unknown"),"score":item.get("score"),"home_away":side,"winner":item.get("isWinner"),"logo":None})
            status=g.get("status",{})
            games.append({"id":"mlb:"+str(g.get("gamePk")),"name":g.get("seriesDescription",""),"date":g.get("gameDate",""),"status":status.get("detailedState",""),"state":state(status.get("abstractGameState")),"teams":teams,"venue":(g.get("venue") or {}).get("name",""),"broadcast":"","url":"https://www.mlb.com/gameday/"+str(g.get("gamePk")),"provider":"mlb_stats"})
    return {"league":"MLB","source_url":"https://www.mlb.com/scores","games":games,"error":None,"window_start":day.strftime("%Y%m%d"),"window_end":day.strftime("%Y%m%d"),"game_count":len(games),"provider":"mlb_stats"}
def nhl(day):
    date=day.isoformat()
    data=fetch("https://api-web.nhle.com/v1/score/"+date);games=[]
    for g in data.get("games",[]):
        teams=[]
        for side in ("away","home"):
            t=g.get(side+"Team") or {}
            name=(t.get("placeName") or {}).get("default","") if isinstance(t.get("placeName"),dict) else t.get("placeName","")
            common=(t.get("commonName") or {}).get("default","") if isinstance(t.get("commonName"),dict) else t.get("commonName","")
            teams.append({"name":(" ".join([name,common]).strip() or (t.get("name") or {}).get("default","Unknown")),"score":t.get("score"),"home_away":side,"winner":None,"logo":t.get("logo")})
        status=g.get("gameState","")
        games.append({"id":"nhl:"+str(g.get("id")),"name":"","date":g.get("startTimeUTC",""),"status":status,"state":"post" if status in ("OFF","FINAL") else "in" if status in ("LIVE","CRIT") else "pre","teams":teams,"venue":(g.get("venue") or {}).get("default",""),"broadcast":", ".join(b.get("network","") for b in g.get("tvBroadcasts",[]) if b.get("network")),"url":"https://www.nhl.com/gamecenter/"+str(g.get("id")),"provider":"nhl_web"})
    return {"league":"NHL","source_url":"https://www.nhl.com/scores","games":games,"error":None,"window_start":day.strftime("%Y%m%d"),"window_end":day.strftime("%Y%m%d"),"game_count":len(games),"provider":"nhl_web"}
def collect():
    now=datetime.now(timezone.utc);out={"updated_at":now.isoformat(timespec="seconds"),"source":"MLB Stats API and NHL Web API","leagues":[]}
    for name,adapter in (("MLB",mlb),("NHL",nhl)):
        block={"league":name,"games":[],"provider":"mlb_stats" if name=="MLB" else "nhl_web","error":None}
        seen=set()
        for offset in (-1,0,1,2):
            day=now.date()+timedelta(days=offset)
            try:
                part=adapter(day)
                for g in part["games"]:
                    if g["id"] not in seen:seen.add(g["id"]);block["games"].append(g)
            except Exception as exc:
                block.setdefault("warnings",[]).append(day.isoformat()+": "+type(exc).__name__+": "+str(exc)[:120])
        block["games"].sort(key=lambda g:g.get("date") or "")
        block["game_count"]=len(block["games"])
        block["window_start"]=(now.date()-timedelta(days=1)).strftime("%Y%m%d")
        block["window_end"]=(now.date()+timedelta(days=2)).strftime("%Y%m%d")
        if not block["games"] and block.get("warnings"):block["error"]="; ".join(block["warnings"])[:300]
        block["source_url"]="https://www.mlb.com/scores" if name=="MLB" else "https://www.nhl.com/scores"
        out["leagues"].append(block)
    (ROOT/"official_scoreboards.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Official adapters:",[(b["league"],len(b["games"]),b["error"]) for b in out["leagues"]])
if __name__=="__main__":collect()

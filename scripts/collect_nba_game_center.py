#!/usr/bin/env python3
"""Publish verified NBA box-score leaders from the official NBA live game endpoint.
Missing/unavailable games remain explicitly unavailable, never fabricated.
"""
import json
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
def fetch(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)","Accept":"application/json"})
    with urlopen(req,timeout=9) as response:return json.load(response)
def main():
    scoreboard=json.loads((ROOT/"official_scoreboards.json").read_text(encoding="utf-8"))
    block=next((x for x in scoreboard.get("leagues",[]) if x.get("league")=="NBA"),{})
    games=[]
    for g in block.get("games",[])[:20]:
        raw=str(g.get("id",""))
        gid=raw.removeprefix("nba:")
        if len(gid)!=10 or not gid.isdigit():continue
        entry={"id":gid,"date":g.get("date"),"status":g.get("status"),"state":g.get("state"),"url":"https://www.nba.com/game/"+gid+"/box-score","teams":[],"leaders":[]}
        for t in g.get("teams",[]):
            entry["teams"].append({"name":t.get("name"),"score":t.get("score"),"home_away":t.get("home_away")})
        if g.get("state") in ("post","in"):
            try:
                box=fetch("https://cdn.nba.com/static/json/liveData/boxscore/boxscore_"+gid+".json").get("game") or {}
                for side in ("awayTeam","homeTeam"):
                    team=box.get(side) or {}
                    for player in team.get("players") or []:
                        stats=player.get("statistics") or {}
                        if not player.get("played"):continue
                        entry["leaders"].append({"name":player.get("name") or (str(player.get("firstName",""))+" "+str(player.get("familyName",""))).strip(),"team":team.get("teamTricode"),"pts":int(stats.get("points") or 0),"reb":int(stats.get("reboundsTotal") or 0),"ast":int(stats.get("assists") or 0)})
                entry["leaders"].sort(key=lambda x:(-x["pts"],-x["reb"],-x["ast"]))
                entry["leaders"]=entry["leaders"][:5]
            except (OSError, ValueError, KeyError, TypeError) as exc:
                entry["detail_error"]=type(exc).__name__
        games.append(entry)
    out={"updated_at":datetime.now(timezone.utc).isoformat(),"source":"NBA official live scoreboard and boxscore; current-day coverage only","games":games}
    (ROOT/"data/nba-game-center.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("NBA game center: "+str(len(games))+" games, "+str(sum(bool(g["leaders"]) for g in games))+" player-leader box scores")
if __name__=="__main__":main()

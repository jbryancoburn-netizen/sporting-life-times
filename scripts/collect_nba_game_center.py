#!/usr/bin/env python3
"""Publish verified NBA box-score leaders from the official NBA live game endpoint.
Missing/unavailable games remain explicitly unavailable, never fabricated.
"""
import json
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
def fetch(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; SportingLifeTimes/1.0)","Accept":"application/json"})
    with urlopen(req,timeout=9) as response:return json.load(response)
def game_record(g):
    gid=str(g.get("gameId",""))
    if len(gid)!=10 or not gid.isdigit():return None
    status=g.get("gameStatus")
    entry={"id":gid,"date":g.get("gameTimeUTC"),"status":g.get("gameStatusText"),"state":"post" if status==3 else "in" if status==2 else "pre","url":"https://www.nba.com/game/"+gid+"/box-score","teams":[],"leaders":[],"players":[]}
    entry["official_stats"]={}
    for side in ("away","home"):
        team=g.get(side+"Team") or {}
        entry["teams"].append({"name":(str(team.get("teamCity") or "")+" "+str(team.get("teamName") or "")).strip(),"score":team.get("score"),"home_away":side,"code":team.get("teamTricode")})
    if status in (2,3):
        try:
            box=(fetch("https://cdn.nba.com/static/json/liveData/boxscore/boxscore_"+gid+".json").get("game") or {})
            for side in ("awayTeam","homeTeam"):
                team=box.get(side) or {}
                st=team.get("statistics") or {}
                side_name="home" if side=="homeTeam" else "away"
                keys={"fga":"fieldGoalsAttempted","oreb":"reboundsOffensive","tov":"turnoversTotal","fta":"freeThrowsAttempted"}
                if all(isinstance(st.get(v),(int,float)) for v in keys.values()):
                    entry["official_stats"][side_name]={"code":team.get("teamTricode"),"points":team.get("score"),**{k:st[v] for k,v in keys.items()}}
                for player in team.get("players") or []:
                    if str(player.get("played", "")).lower() not in ("true", "1"):continue
                    st=player.get("statistics") or {}
                    row={"id":str(player.get("personId") or ""),"name":player.get("name") or (str(player.get("firstName") or "")+" "+str(player.get("familyName") or "")).strip(),"team":team.get("teamTricode"),"pts":int(st.get("points") or 0),"reb":int(st.get("reboundsTotal") or 0),"ast":int(st.get("assists") or 0),"stl":int(st.get("steals") or 0),"blk":int(st.get("blocks") or 0),"tov":int(st.get("turnovers") or 0),"fgm":int(st.get("fieldGoalsMade") or 0),"fga":int(st.get("fieldGoalsAttempted") or 0),"fg3m":int(st.get("threePointersMade") or 0),"fg3a":int(st.get("threePointersAttempted") or 0),"ftm":int(st.get("freeThrowsMade") or 0),"fta":int(st.get("freeThrowsAttempted") or 0),"min":st.get("minutes") or ""}
                    entry["players"].append(row)
            entry["leaders"]=sorted(entry["players"],key=lambda x:(-x["pts"],-x["reb"],-x["ast"]))[:5]
        except (OSError,ValueError,KeyError,TypeError) as exc:entry["detail_error"]=type(exc).__name__
    return entry

def main():
    outpath=ROOT/"data/nba-game-center.json"
    previous={"games":[]}
    if outpath.exists():
        try:previous=json.loads(outpath.read_text(encoding="utf-8"))
        except (ValueError,OSError):pass
    prior={g["id"]:g for g in previous.get("games",[]) if g.get("id")}
    source="https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
    try:
        scoreboard=(fetch(source).get("scoreboard") or {})
        raw=scoreboard.get("games") or []
        with ThreadPoolExecutor(max_workers=6) as pool:
            current=[g for g in pool.map(game_record,raw) if g]
    except (OSError,ValueError,KeyError,TypeError) as exc:
        current=[]
        print("NBA official feed unavailable: "+type(exc).__name__+"; retaining last verified archive")
    for game in current:
        old=prior.get(game["id"])
        if old and old.get("state")=="post" and old.get("players") and not game.get("players"):continue
        prior[game["id"]]=game
    games=sorted(prior.values(),key=lambda x:(x.get("date") or "",x["id"]),reverse=True)
    # Retain regular-season archive from this edition's first capture onward.
    # Never present this as historical completeness without a backfill audit.
    out={"updated_at":datetime.now(timezone.utc).isoformat(),"source":"NBA official live scoreboard and boxscore; cumulative captured archive (not guaranteed complete)","games":games,"coverage":{"archived_games":len(games),"boxscores_with_players":sum(bool(g.get("players")) for g in games),"first_game_date":min((g.get("date") for g in games if g.get("date")),default=None),"last_game_date":max((g.get("date") for g in games if g.get("date")),default=None)}}
    outpath.parent.mkdir(parents=True,exist_ok=True)
    if not out["coverage"]["boxscores_with_players"]:
        raise RuntimeError("No completed NBA player box scores captured; refusing empty archive publication")
    outpath.write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("NBA archive: "+str(len(games))+" games; "+str(out["coverage"]["boxscores_with_players"])+" full player box scores")
if __name__=="__main__":main()

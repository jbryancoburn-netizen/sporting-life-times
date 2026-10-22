#!/usr/bin/env python3
"""Independent official-league scoreboard adapters; no fabricated game records."""
import json
from datetime import datetime,timezone,timedelta,date
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
                teams.append({"name":team.get("name","Unknown"),"score":item.get("score"),"home_away":side,"winner":item.get("isWinner"),"logo":("https://www.mlbstatic.com/team-logos/"+str(team["id"])+".svg") if team.get("id") else None,"team_id":team.get("id")})
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
            abbr=t.get("abbrev","")
            cities={"ANA":"Anaheim","BOS":"Boston","BUF":"Buffalo","CAR":"Carolina","CBJ":"Columbus","CGY":"Calgary","CHI":"Chicago","COL":"Colorado","DAL":"Dallas","DET":"Detroit","EDM":"Edmonton","FLA":"Florida","LAK":"Los Angeles","MIN":"Minnesota","MTL":"Montreal","NJD":"New Jersey","NSH":"Nashville","NYI":"New York","NYR":"New York","OTT":"Ottawa","PHI":"Philadelphia","PIT":"Pittsburgh","SEA":"Seattle","SJS":"San Jose","STL":"St. Louis","TBL":"Tampa Bay","TOR":"Toronto","UTA":"Utah","VAN":"Vancouver","VGK":"Vegas","WPG":"Winnipeg","WSH":"Washington"}
            full=(" ".join([name,common]).strip() if name else " ".join([cities.get(abbr,""),common]).strip())
            teams.append({"name":full or common or str(abbr or "Unknown"),"score":t.get("score"),"home_away":side,"winner":None,"logo":t.get("logo"),"team_id":abbr})
        status=g.get("gameState","")
        games.append({"id":"nhl:"+str(g.get("id")),"name":"","date":g.get("startTimeUTC",""),"status":status,"state":"post" if status in ("OFF","FINAL") else "in" if status in ("LIVE","CRIT") else "pre","teams":teams,"venue":(g.get("venue") or {}).get("default",""),"broadcast":", ".join(b.get("network","") for b in g.get("tvBroadcasts",[]) if b.get("network")),"url":"https://www.nhl.com/gamecenter/"+str(g.get("id")),"provider":"nhl_web"})
    return {"league":"NHL","source_url":"https://www.nhl.com/scores","games":games,"error":None,"window_start":day.strftime("%Y%m%d"),"window_end":day.strftime("%Y%m%d"),"game_count":len(games),"provider":"nhl_web"}
def standings_snapshot(league,day):
    """End-of-day official division standings. Missing fields remain absent."""
    if league=="NHL":
        data=fetch("https://api-web.nhle.com/v1/standings/"+day.isoformat())
        result={}
        for row in data.get("standings",[]):
            abbr=(row.get("teamAbbrev") or {}).get("default")
            rank=row.get("divisionSequence")
            if not abbr or not isinstance(rank,int):continue
            result[str(abbr)]={"wins":row.get("wins"),"losses":row.get("losses"),"ot_losses":row.get("otLosses"),"rank":rank,"division":str((row.get("divisionAbbrev") or row.get("divisionName") or "") if isinstance(row.get("divisionAbbrev") or row.get("divisionName"),str) else (row.get("divisionName") or {}).get("default",""))}
        return result
    data=fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season="+str(day.year)+"&date="+day.isoformat()+"&standingsTypes=regularSeason")
    # Postseason dated queries can return no regular-season rows. Fall back
    # to the official season standings, clearly labeled as season-final.
    if not data.get("records"):
        data=fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season="+str(day.year)+"&standingsTypes=regularSeason")
    result={}
    mlb_divisions={200:"ALW",201:"ALE",202:"ALC",203:"NLW",204:"NLE",205:"NLC"}
    for block in data.get("records",[]):
        for row in block.get("teamRecords",[]):
            ident=(row.get("team") or {}).get("id")
            try:rank=int(row.get("divisionRank"))
            except (TypeError,ValueError):continue
            if ident is not None:result[str(ident)]={"wins":row.get("wins"),"losses":row.get("losses"),"rank":rank,"division":mlb_divisions.get(int((block.get("division") or {}).get("id") or 0),""),"season_final":True if day.month>=10 else False}
    return result

def enrich_standings(block):
    """Show before/after only from separate official dated snapshots.
    Dates represent start/end of game day, not intraday ordering.
    """
    league=block["league"];cache={}
    today=datetime.now(timezone.utc).date()
    for game in block["games"]:
        try:game_day=date.fromisoformat(game["date"][:10])
        except (ValueError,KeyError):continue
        before_day=game_day-timedelta(days=1)
        # Future games can use yesterday's actual standings as a pregame approximation
        # only when the game is today; future dates have intervening games.
        if game["state"]!="post" and game_day!=today:continue
        days=[before_day]+([game_day] if game["state"]=="post" else [])
        for d in days:
            if d not in cache:
                try:cache[d]=standings_snapshot(league,d)
                except Exception as exc:
                    cache[d]={}
                    block.setdefault("standings_warnings",[]).append(d.isoformat()+": "+type(exc).__name__)
        for team in game["teams"]:
            ident=team.get("team_id")
            if not ident:continue
            pre=cache[before_day].get(str(ident))
            post=cache.get(game_day,{}).get(str(ident))
            if pre or post:
                team["standings"]={"scope":"division","before":pre,"after":post,"basis":"official_daily_snapshots"}
    return block

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
        enrich_standings(block)
        block["game_count"]=len(block["games"])
        block["window_start"]=(now.date()-timedelta(days=1)).strftime("%Y%m%d")
        block["window_end"]=(now.date()+timedelta(days=2)).strftime("%Y%m%d")
        if not block["games"] and block.get("warnings"):block["error"]="; ".join(block["warnings"])[:300]
        block["source_url"]="https://www.mlb.com/scores" if name=="MLB" else "https://www.nhl.com/scores"
        out["leagues"].append(block)
    (ROOT/"official_scoreboards.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Official adapters:",[(b["league"],len(b["games"]),b["error"]) for b in out["leagues"]])
if __name__=="__main__":collect()

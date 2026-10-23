#!/usr/bin/env python3
"""Fetch attributed public ESPN scoreboards. Never manufacture scores or statuses."""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
LEAGUES=[("NFL","football/nfl"),("MLB","baseball/mlb"),("NBA","basketball/nba"),("NHL","hockey/nhl"),("Premier League","soccer/eng.1"),("College Football","football/college-football"),("Men's College Basketball","basketball/mens-college-basketball"),("Women's College Basketball","basketball/womens-college-basketball"),("Champions League","soccer/uefa.champions"),("Europa League","soccer/uefa.europa"),("Australian NBL","basketball/aus.nbl"),("EuroLeague","basketball/euroleague"),("ECHL","hockey/echl"),("College Baseball","baseball/college-baseball"),("NCAA Men's Soccer","soccer/usa.ncaa.m.1"),("NCAA Men's Hockey","hockey/mens-college-hockey")]
def espn_standings(path):
    """Return verified division standings from ESPN; never invent rank or movement."""
    req=Request("https://site.api.espn.com/apis/v2/sports/"+path+"/standings",headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
    with urlopen(req,timeout=12) as response: data=json.load(response)
    result={}
    groups={"AFC East":("BUF","MIA","NE","NYJ"),"AFC North":("BAL","CIN","CLE","PIT"),"AFC South":("HOU","IND","JAX","TEN"),"AFC West":("DEN","KC","LAC","LV"),"NFC East":("DAL","NYG","PHI","WSH"),"NFC North":("CHI","DET","GB","MIN"),"NFC South":("ATL","CAR","NO","TB"),"NFC West":("ARI","LA","SF","SEA")}
    team_division={abbr:division for division,members in groups.items() for abbr in members}
    def walk(node,division=""):
        name=str(node.get("name") or node.get("abbreviation") or "")
        if name.lower() in ("east","west","north","south","atlantic","central","pacific","southeast","northwest","southwest") or (name.startswith(("AFC ","NFC ")) and name.split(" ")[-1] in ("East","West","North","South")):
            division=name
        standings=node.get("standings") or {}
        entries=standings.get("entries") or []
        for index,entry in enumerate(entries):
            team=entry.get("team") or {}
            ident=team.get("id")
            stats={str(x.get("name") or x.get("abbreviation") or "").lower():x for x in entry.get("stats",[])}
            def number(*keys):
                for key in keys:
                    v=stats.get(key.lower()) or {}
                    raw=v.get("value")
                    if raw is not None:
                        try:return int(raw)
                        except (TypeError,ValueError):pass
                return None
            wins=number("wins","W");losses=number("losses","L")
            abbr=str(team.get("abbreviation") or "").upper()
            team_group=team_division.get(abbr,division) if path=="football/nfl" else division
            rank=number("divisionRank","divisionStanding","divisionPlace")
            if rank is None and division and entries and all(team_division.get(str((e.get("team") or {}).get("abbreviation") or "").upper())==team_group for e in entries) and path=="football/nfl":rank=index+1
            if ident and wins is not None and losses is not None:
                result[str(ident)]={"wins":wins,"losses":losses,"rank":rank,"division":team_group}
        for child in node.get("children") or []:walk(child,division)
    walk(data)
    return result

out={"updated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"source":"ESPN public scoreboard API","leagues":[]}
for label,path in LEAGUES:
    url="https://site.api.espn.com/apis/site/v2/sports/"+path+"/scoreboard"
    block={"league":label,"source_url":"https://www.espn.com/"+path+"/scoreboard","provider":"espn","games":[],"error":None}
    today=datetime.now(timezone.utc).date()
    start=(today-timedelta(days=4)).strftime("%Y%m%d")
    end=(today+timedelta(days=7)).strftime("%Y%m%d")
    query_url=url+"?dates="+start+"-"+end+"&limit=250"
    block["window_start"]=start
    block["window_end"]=end
    logo_by_id={}
    standings={}
    missing_logo_ids=set()
    if label in ("NFL","NBA"):
        try:standings=espn_standings(path)
        except Exception as exc:block["standings_warning"]=type(exc).__name__
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
        req=Request(query_url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
        try:
            with urlopen(req,timeout=12) as response: data=json.load(response)
        except Exception:
            # Some ESPN sports reject multi-day date ranges with HTTP 400.
            # Retry the documented single-day scoreboard endpoint.
            req=Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
            with urlopen(req,timeout=12) as response: data=json.load(response)
            block["window_start"]=today.strftime("%Y%m%d")
            block["window_end"]=today.strftime("%Y%m%d")
        for ev in data.get("events",[])[:250]:
            comp=(ev.get("competitions") or [{}])[0]
            competitors=comp.get("competitors",[])
            teams=[]
            for c in competitors:
                t=c.get("team") or {}
                teams.append({"espn_team_id":str(t.get("id") or ""),"name":t.get("displayName") or t.get("name") or "Unknown","national_rank":(int(c["curatedRank"]["current"]) if str((c.get("curatedRank") or {}).get("current","")).isdigit() and 1<=int(c["curatedRank"]["current"])<=25 and label in ("College Football","Men\'s College Basketball","Women\'s College Basketball") else None),"score":c.get("score"),"linescores":[{"value":x.get("displayValue") if x.get("displayValue") is not None else x.get("value"),"period":x.get("period")} for x in (c.get("linescores") or []) if isinstance(x,dict)],"home_away":c.get("homeAway"),"winner":c.get("winner"),"logo":next((x.get("href") for x in (t.get("logos") or []) if x.get("href","").startswith("https://")),None) or logo_by_id.get(str(t.get("id"))),"standings":({"before":standings[str(t.get("id"))],"after":None,"basis":"espn_current_standings"} if str(t.get("id")) in standings else None)})
            status=ev.get("status") or {}
            block["games"].append({"id":str(ev.get("id","")),"name":ev.get("name",""),"date":ev.get("date",""),"status":(status.get("type") or {}).get("description","Unknown"),"state":(status.get("type") or {}).get("state",""),"teams":teams,"venue":(comp.get("venue") or {}).get("fullName",""),"broadcast":", ".join(x.get("names",[""])[0] for x in comp.get("broadcasts",[]) if x.get("names")),"url":((comp.get("links") or ev.get("links") or [{}])[0]).get("href",block["source_url"])})
    except Exception as exc: block["error"]=type(exc).__name__+": "+str(exc)[:100]
    # Recover missing ESPN logos by stable provider team ID, never by guessed URL.
    # The scoreboard and team-list endpoints occasionally omit a team's crest.
    if label=="College Football" and block["games"]:
        for game in block["games"]:
            for team in game["teams"]:
                if not team.get("logo"):
                    missing_logo_ids.add(team.get("espn_team_id"))
        for team_id in sorted(missing_logo_ids-{None,""}):
            try:
                detail_url="https://site.api.espn.com/apis/site/v2/sports/"+path+"/teams/"+str(team_id)
                detail_req=Request(detail_url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
                with urlopen(detail_req,timeout=8) as response: detail=json.load(response)
                info=detail.get("team") or {}
                logo=next((x.get("href") for x in (info.get("logos") or []) if str(x.get("href","")).startswith("https://")),None)
                if logo:logo_by_id[str(team_id)]=logo
            except Exception:
                continue
        for game in block["games"]:
            for team in game["teams"]:
                if not team.get("logo"):team["logo"]=logo_by_id.get(str(team.get("espn_team_id")))
    for game in block["games"]:
        for team in game["teams"]:team.pop("espn_team_id",None)
    block["games"].sort(key=lambda g:g.get("date") or "")
    block.setdefault("window_start",start)
    block.setdefault("window_end",end)
    block["game_count"]=len(block["games"])
    out["leagues"].append(block)
(ROOT/"scoreboards.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Fetched",sum(len(x["games"]) for x in out["leagues"]),"games across",len(LEAGUES),"leagues")

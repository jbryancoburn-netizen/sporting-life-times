#!/usr/bin/env python3
"""Enrich captured ESPN NBA finals with validated period scores and team comparisons."""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
FILE=ROOT/"data/nba-game-center.json"
BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event="
ALIASES={"NY":"NYK","GS":"GSW","SA":"SAS","NO":"NOP","UTAH":"UTA","WSH":"WAS"}

def fetch(gid):
    req=Request(BASE+str(gid),headers={"Accept":"application/json","User-Agent":"Mozilla/5.0"})
    with urlopen(req,timeout=14) as resp:return json.load(resp)

def code(v):
    return ALIASES.get(v,v)

def periods(summary, game):
    competition=(((summary.get("header") or {}).get("competitions") or [{}])[0])
    competitors=competition.get("competitors") or []
    out={}
    for t in competitors:
        side=t.get("homeAway")
        if side not in ("home","away"):continue
        raw=t.get("linescores") or []
        vals=[]
        for line in raw:
            try:
                v=float(line.get("displayValue",line.get("value")))
                if v<0 or v!=int(v):return None
                vals.append(int(v))
            except (ValueError,TypeError,AttributeError):return None
        if len(vals)<4:return None
        saved=next((x for x in game["teams"] if x.get("home_away")==side),None)
        if not saved or sum(vals)!=int(saved.get("score",-1)):return None
        out[side]=vals
    if set(out)!={"away","home"} or len(out["away"])!=len(out["home"]):return None
    return out

FIELDS={
 "fieldGoalPct":"FG%","threePointFieldGoalPct":"3PT%","freeThrowPct":"FT%",
 "totalRebounds":"REB","rebounds":"REB","assists":"AST",
 "turnovers":"TO","totalTurnovers":"TO","pointsInPaint":"PAINT",
 "fastBreakPoints":"FAST BREAK","benchPoints":"BENCH"}
def team_comparison(summary,game):
    teams=(summary.get("boxscore") or {}).get("teams") or []
    output={}
    for t in teams:
        team=t.get("team") or {}
        c=code(team.get("abbreviation"))
        side=next((x["home_away"] for x in game["teams"] if x.get("code")==c),None)
        if not side:continue
        stats={}
        for st in t.get("statistics") or []:
            label=FIELDS.get(st.get("name")) or FIELDS.get(st.get("abbreviation"))
            if not label:continue
            raw=st.get("displayValue",st.get("value"))
            try:
                v=float(str(raw).replace("%","").replace(",",""))
                if not 0<=v<=500:return None
                stats[label]=round(v,1)
            except (ValueError,TypeError):continue
        if stats:output[side]=stats
    return output if "away" in output and "home" in output else None

def possession_inputs(summary, game):
    """Observed ESPN team totals, attributed separately from official NBA inputs."""
    season=(summary.get("header") or {}).get("season") or {}
    competition=(((summary.get("header") or {}).get("competitions") or [{}])[0])
    if (game.get("state")!="post" or season.get("year")!=2027 or season.get("type")!=2
        or not ((competition.get("status") or {}).get("type") or {}).get("completed")
        or not periods(summary,game)):
        return None
    output={}
    def count(value):
        number=float(value)
        if not number.is_integer() or not 0<=number<=200:raise ValueError("Invalid count")
        return int(number)
    try:
        for item in (summary.get("boxscore") or {}).get("teams") or []:
            team=code((item.get("team") or {}).get("abbreviation"))
            saved=next((t for t in game["teams"] if t.get("code")==team),None)
            if not saved:return None
            side=saved["home_away"]
            if side in output:return None
            stats={v["name"]:v.get("displayValue",v.get("value")) for v in item.get("statistics",[])}
            def shots(name):
                made,attempted=map(count,str(stats[name]).split("-"))
                if made>attempted:raise ValueError("Makes exceed attempts")
                return made,attempted
            fgm,fga=shots("fieldGoalsMade-fieldGoalsAttempted")
            threes,three_attempts=shots("threePointFieldGoalsMade-threePointFieldGoalsAttempted")
            ftm,fta=shots("freeThrowsMade-freeThrowsAttempted")
            oreb=count(stats["offensiveRebounds"])
            tov=count(stats["totalTurnovers"])
            points=count(saved["score"])
            if (fga<=0 or threes>fgm or three_attempts>fga or oreb>fga
                or 2*fgm+threes+ftm!=points):return None
            output[side]={"code":team,"points":points,"fga":fga,"oreb":oreb,"tov":tov,"fta":fta}
    except (KeyError,ValueError,TypeError):
        return None
    if set(output)!={"home","away"}:return None
    return {"source":"ESPN completed-game team box score", "source_url":BASE+str(game["id"]).removeprefix("espn-nba-"),
            "regular_season":True,"season":"2026-27", **output}

def enrich(game,summary):
    result=dict(game)
    period=periods(summary,game)
    if period:result["period_scores"]=period
    stats=team_comparison(summary,game)
    if stats:result["team_comparison"]=stats
    inputs=possession_inputs(summary,game)
    if inputs:result["possession_stats"]=inputs
    return result

def main():
    data=json.loads(FILE.read_text())
    pending=[g for g in data.get("games",[]) if g.get("state")=="post" and str(g.get("id","")).startswith("espn-nba-") and (not g.get("period_scores") or not g.get("team_comparison") or not g.get("possession_stats"))]
    def collect(g):
        try:
            result=enrich(g,fetch(g["id"].split("espn-nba-")[-1]))
            return g["id"],result
        except (OSError,ValueError,KeyError,TypeError) as e:
            print("Skipped enrichment",g["id"],type(e).__name__)
            return g["id"],g
    with ThreadPoolExecutor(max_workers=4) as pool:
        replacements=dict(pool.map(collect,pending))
    changed=0
    for i,g in enumerate(data["games"]):
        new=replacements.get(g["id"],g)
        if new!=g:data["games"][i]=new;changed+=1
    if changed:
        data["enriched_at"]=datetime.now(timezone.utc).isoformat()
        FILE.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n")
    print("NBA game center enrichment:",changed,"games enriched of",len(pending),"checked")
if __name__=="__main__":main()

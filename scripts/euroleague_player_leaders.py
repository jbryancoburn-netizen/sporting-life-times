"""Publish verified EuroLeague 2026-27 player leaderboards, fail closed on schema changes."""
import datetime as dt
import json, pathlib, urllib.request, urllib.parse
OUT=pathlib.Path("data/euroleague-player-leaders.json")
BASE="https://api-live.euroleague.net/v3/competitions/E/statistics/players/traditional"
def get(offset):
    q=urllib.parse.urlencode({"SeasonMode":"Single","SeasonCode":"E2026","statisticMode":"PerGame","limit":100,"offset":offset})
    req=urllib.request.Request(BASE+"?"+q,headers={"User-Agent":"SportingLifeTimes-EuroLeaguePlayerDesk/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=40) as response:return json.load(response)
def val(d,*keys):
    if not isinstance(d,dict):return None
    for key in keys:
        if d.get(key) is not None:return d[key]
    return None
def number(x):
    try:
        f=float(x)
        return f if 0<=f<1000 else None
    except (TypeError,ValueError):return None
def flatten(item):
    player=val(item,"player","person","Player") or {}
    club=val(item,"club","team","Team") or val(player,"team","Team") or {}
    stats=val(item,"statistics","stats","Statistics") or {}
    if not isinstance(stats,dict):stats={}
    if not isinstance(player,dict):player={}
    if not isinstance(club,dict):club={}
    name=val(item,"playerName","player_name","Name","name","fullName") or val(player,"name","Name","fullName","displayName")
    code=val(item,"clubCode","teamCode","player_team_code","playerTeamCode") or val(player,"teamCode","TeamCode") or val(club,"code","Code","clubCode","tvCode","TvCode")
    played=number(val(item,"gamesPlayed","games_played","GamesPlayed","games","played") or val(stats,"gamesPlayed","GamesPlayed","games","played"))
    photo=val(item,"imageUrl","player_image_url","playerImageUrl","photoUrl") or val(player,"imageUrl","ImageUrl","photoUrl","image")
    if not isinstance(photo,str) or not photo.startswith("https://"):photo=None
    values={}
    for key,aliases in {"points":("points","Points","points_scored","pointsScored","PointsScored","pts","pointsPerGame"),"rebounds":("totalRebounds","TotalRebounds","total_rebounds","rebounds","Rebounds","reb","reboundsPerGame"),"assists":("assists","Assists","ast","assistsPerGame"),"pir":("valuation","Valuation","pir","PIR","performanceIndexRating")}.items():
        raw=val(item,*aliases)
        if raw is None:raw=val(stats,*aliases)
        values[key]=number(raw)
    if not name or not isinstance(name,str) or not code or not isinstance(code,str):return None
    return {"name":name.strip(),"club":code.strip().upper(),"games":played,"photo":photo,**values}
def main():
    rows=[];total=None
    for offset in range(0,1200,100):
        data=get(offset)
        items=data if isinstance(data,list) else val(data,"data","items","players","Players","results")
        if not isinstance(items,list):raise ValueError("Unknown EuroLeague player-statistics envelope")
        if isinstance(data,dict) and isinstance(data.get("total"),int):total=data["total"]
        if offset==0 and items:\n            print("EUROLEAGUE_SCHEMA_DIAGNOSTIC",json.dumps({"envelope":list(data) if isinstance(data,dict) else "list","first_row":items[0]},ensure_ascii=False)[:5500],flush=True)\n        rows.extend(items)
        if len(items)<100 or total is not None and len(rows)>=total:break
    if len(rows)<100:raise ValueError("Incomplete player statistics: "+str(len(rows)))
    parsed=[flatten(row) for row in rows]
    parsed=[row for row in parsed if row]
    if len(parsed)<100:raise ValueError("Player identity/stat schema incomplete: "+str(len(parsed)))
    leaders={}
    for key in ("points","rebounds","assists","pir"):
        ranked=[p for p in parsed if p[key] is not None and (p["games"] is None or p["games"]>=2)]
        if len(ranked)<20:raise ValueError("Missing "+key+" player statistics; no publication")
        ranked.sort(key=lambda p:(-p[key],p["name"]))
        leaders[key]=ranked[:15]
    output={"season":"2026-27","updated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"EuroLeague v3 traditional season player statistics · PerGame","players_parsed":len(parsed),"leaders":leaders}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
    print("Verified",len(parsed),"EuroLeague player rows")
if __name__=="__main__":main()

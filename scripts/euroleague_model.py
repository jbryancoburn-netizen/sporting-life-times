"""Independent EuroLeague Elo and provisional score projections.
No ratings are imported. All results come from EuroLeague's games endpoint.
Usage: python scripts/euroleague_model.py
"""
import datetime as dt
import json, math, pathlib, time, urllib.error, urllib.request

BASE="https://api-live.euroleague.net/v2/competitions/E/seasons/"
OUT=pathlib.Path("data/euroleague-model.json")
NOW=dt.datetime.now(dt.timezone.utc)
K=22.0
HOME_ELO=65.0  # provisional: calibrate by walk-forward historical log loss
CARRY=0.67
def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes-EuroLeagueResearch/1.0","Accept":"application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
        except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError):
            if attempt==3:raise
            time.sleep(2**attempt)
def obj(v):return v if isinstance(v,dict) else {}
def field(d,*names):
    for name in names:
        x=obj(d).get(name)
        if x is not None:return x
    return None
def team(game,key):
    side=obj(field(game,key,"local" if key=="local" else "road"))
    club=obj(field(side,"club"))
    code=field(club,"code","clubCode") or field(side,"clubCode","code")
    name=field(club,"name","clubName","abbreviatedName") or field(side,"name","clubName")
    crest=field(obj(field(club,"images")),"crest") or field(club,"imageUrl") or field(side,"clubImageUrl")
    score=field(side,"score","standingsScore")
    return {"code":str(code or "").strip(),"name":str(name or code or "").strip(),"logo":crest,"score":score}
def parse(raw,season):
    d=obj(raw);arr=field(d,"data","games","items")
    if not isinstance(arr,list):
        raise ValueError("Unexpected games payload: no games array for "+season)
    games=[]
    for g in arr:
        if not isinstance(g,dict):continue
        home=team(g,"local");away=team(g,"road")
        if not home["code"] or not away["code"] or home["code"]==away["code"]:continue
        date=field(g,"utcDate","date","localDate")
        status=str(field(g,"gameStatus","status") or "").lower()
        played=field(g,"played","isPlayed")
        hs,aws=home["score"],away["score"]
        completed=(played is True or status in ("played","result","finished","final","closed")) and isinstance(hs,(int,float)) and isinstance(aws,(int,float)) and not isinstance(hs,bool) and not isinstance(aws,bool)
        if completed and (hs==aws or hs<0 or aws<0):raise ValueError("Invalid completed score: "+str(g.get("gameCode")))
        games.append({"id":str(field(g,"gameCode","code","id") or ""),"season":season,"date":date,"home":home,"away":away,"completed":completed,"neutral":bool(field(g,"isNeutralVenue","neutralVenue") or False)})
    if not games:raise ValueError("No readable fixtures for "+season+"; API schema may have changed")
    # API normally returns full season; fail closed on partial data
    total=field(d,"total","totalCount")
    if isinstance(total,int) and len(games)<total:raise ValueError(f"Partial season {season}: {len(games)}/{total}; pagination required")
    return games
def clock(s):
    if not s:return dt.datetime.max.replace(tzinfo=dt.timezone.utc)
    try:
        d=dt.datetime.fromisoformat(str(s).replace("Z","+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
    except ValueError:return dt.datetime.max.replace(tzinfo=dt.timezone.utc)
def expected(diff):return 1/(1+10**(-diff/400))
def fetch_season(season):
    page_size=100
    games=[]
    total=None
    for offset in range(0,1500,page_size):
        raw=get(BASE+season+f"/games?limit={page_size}&offset={offset}")
        rows=field(raw,"data","games","items")
        if not isinstance(rows,list):raise ValueError("Invalid EuroLeague page for "+season)
        reported=field(raw,"total","totalCount")
        if isinstance(reported,int):total=reported
        # Parse each page without the season-total completeness check.
        page=dict(obj(raw));page.pop("total",None);page.pop("totalCount",None)
        if not rows:break
        converted=parse(page,season)
        games.extend(converted)
        if total is not None and len(games)>=total:break
        if len(rows)<page_size and total is None:break
    if total is not None and len(games)!=total:
        raise ValueError(f"Incomplete {season}: parsed {len(games)} of {total} fixtures")
    codes=[g["id"] for g in games]
    if not all(codes) or len(codes)!=len(set(codes)):
        raise ValueError("Duplicate or missing game identifiers in "+season)
    return games

def main():
    all_games=[]
    for year in (2024,2025,2026):
        s="E"+str(year)
        all_games+=fetch_season(s)
    # Reconstruct season chronologically; previous season used solely for initial strength.
    all_games.sort(key=lambda g:(g["season"],clock(g["date"]),g["id"]))
    ratings={}; stats={}; history=[]; season_seen=None
    team_info={}
    for game in all_games:
        h,a=game["home"],game["away"]
        for t in (h,a):team_info[t["code"]]={"code":t["code"],"name":t["name"],"logo":t["logo"]}
        if season_seen!=game["season"]:
            season_seen=game["season"]
            ratings={k:1500+(v-1500)*CARRY for k,v in ratings.items()}
        for t in (h,a):ratings.setdefault(t["code"],1500.0)
        if game["season"]=="E2026":break
        if not game["completed"]:continue
        diff=ratings[h["code"]]-ratings[a["code"]]+(0 if game["neutral"] else HOME_ELO)
        p=expected(diff);out=1 if h["score"]>a["score"] else 0
        margin=abs(h["score"]-a["score"])
        factor=min(1.65,0.80+0.22*math.log1p(margin))
        delta=K*factor*(out-p)
        ratings[h["code"]]+=delta;ratings[a["code"]]-=delta
    # First E2026 record already triggered the rollover in the chronological loop.
    current=[g for g in all_games if g["season"]=="E2026"]
    current.sort(key=lambda g:(clock(g["date"]),g["id"]))
    active={t["code"] for g in current for t in (g["home"],g["away"])}
    for g in current:
        for t in (g["home"],g["away"]):team_info[t["code"]]={"code":t["code"],"name":t["name"],"logo":t["logo"]}
    for code in active:ratings.setdefault(code,1500.)
    for g in current:
        h,a=g["home"],g["away"]
        if not g["completed"]:continue
        if clock(g["date"])>NOW+dt.timedelta(hours=2):raise ValueError("Future dated final; refusing publication")
        p=expected(ratings[h["code"]]-ratings[a["code"]]+(0 if g["neutral"] else HOME_ELO))
        result=1 if h["score"]>a["score"] else 0
        margin=abs(h["score"]-a["score"])
        factor=min(1.65,0.80+0.22*math.log1p(margin))
        change=K*factor*(result-p)
        ratings[h["code"]]+=change;ratings[a["code"]]-=change
        for t,points,against,win in ((h,h["score"],a["score"],result),(a,a["score"],h["score"],1-result)):
            st=stats.setdefault(t["code"],{"played":0,"wins":0,"losses":0,"for":0,"against":0})
            st["played"]+=1;st["wins"]+=win;st["losses"]+=1-win;st["for"]+=points;st["against"]+=against
        history.append({"id":g["id"],"date":g["date"],"home":h["code"],"away":a["code"],"score":[h["score"],a["score"]],"pregame_home_probability":round(p,5)})
    if not current or not active or not history:raise ValueError("No verified current season finals; refusing uncalculated Elo publication")
    ids=[g["id"] for g in current]
    if len(ids)!=len(set(ids)) or any(not x for x in ids):raise ValueError("Missing or duplicate EuroLeague game codes")
    if len(active)<18 or len(active)>24:raise ValueError("Unexpected number of EuroLeague participants")
    ranked=[{**team_info[c],"elo":round(ratings[c],1),**stats.get(c,{"played":0,"wins":0,"losses":0,"for":0,"against":0})} for c in active]
    ranked.sort(key=lambda x:(-x["elo"],x["name"]))
    # Temporary 40-minute points model based on current season observed PPG.
    # Withhold projected scores before both clubs have at least 5 observations.
    avg_for=sum(v["for"] for v in stats.values())/sum(v["played"] for v in stats.values()) if stats else None
    fixtures=[]
    for g in current:
        if g["completed"] or clock(g["date"])<NOW-dt.timedelta(hours=6):continue
        h,a=g["home"]["code"],g["away"]["code"]
        probability=expected(ratings[h]-ratings[a]+(0 if g["neutral"] else HOME_ELO))
        hst,ast=stats.get(h,{}),stats.get(a,{})
        projection=None
        if hst.get("played",0)>=5 and ast.get("played",0)>=5:
            # Independent scoring model: each club's offense / opponent defense shrunk to league pace.
            hp=0.5*(hst["for"]/hst["played"]+ast["against"]/ast["played"])
            ap=0.5*(ast["for"]/ast["played"]+hst["against"]/hst["played"])
            projected_home=0.7*hp+0.3*avg_for+(1.5 if not g["neutral"] else 0)
            projected_away=0.7*ap+0.3*avg_for-(1.5 if not g["neutral"] else 0)
            projection={"home":round(projected_home,1),"away":round(projected_away,1),"spread_home":round(projected_away-projected_home,1),"total":round(projected_home+projected_away,1),"status":"experimental_uncalibrated"}
        fixtures.append({"id":g["id"],"date":g["date"],"home":g["home"],"away":g["away"],"home_win_probability":round(probability,4),"projection":projection})
    payload={"model":"Sporting Life & Times independent EuroLeague Elo v0.1","season":"2026-27","updated_at":NOW.isoformat(),"source":"EuroLeague public v2 games endpoint","settings":{"K":K,"home_elo":HOME_ELO,"season_carry":CARRY,"calibrated":False},"games_ingested":len(current),"games_completed":len(history),"rankings":ranked,"fixtures":fixtures,"recent_results":history[-15:][::-1],"coverage":"Games and ratings verified from source payload; forecast scoring experimental; no injuries or transfers"}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    if OUT.exists():
        previous=json.loads(OUT.read_text())
        if previous.get("season")==payload["season"] and previous.get("games_completed",0)>payload["games_completed"]:
            raise ValueError("Source regression: fewer finals than previously published; refusing overwrite")
    temp=OUT.with_suffix(".tmp");temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n");temp.replace(OUT)
    print(f"EuroLeague: {len(ranked)} clubs, {len(history)} finals, {len(fixtures)} fixtures")
if __name__=="__main__":main()

"""Publish NCAA soccer in-progress scores without affecting the verified-final Elo ledger."""
import datetime as dt
import json
import pathlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
API="https://ncaa-api.henrygd.me/scoreboard"
OUT=ROOT/"data/college-soccer-live-scores.json"
def normalize(entry,gender,division):
    g=entry.get("game") or {}
    gid=str(g.get("gameID") or "").strip()
    if not gid:return None
    state=str(g.get("gameState") or "").lower()
    if state not in ("live","inprogress","in-progress","final"):return None
    home,away=g.get("home") or {},g.get("away") or {}
    def score(team):
        val=team.get("score")
        if val is None or str(val).strip()=="":return None
        try:
            v=int(val)
            return v if 0<=v<=40 else None
        except (ValueError,TypeError):return None
    h,a=score(home),score(away)
    if h is None or a is None:return None
    return {"match_id":f"{gender}-{gid}","cohort":f"{gender}-d{division}","status":"final" if state=="final" else "live","home_score":h,"away_score":a,"period":str(g.get("currentPeriod") or g.get("contestClock") or ""), "source_url":f"https://www.ncaa.com/game/{gid}"}
def collect(today=None,get=None):
    today=today or dt.datetime.now(ZoneInfo('America/New_York')).date()
    if get is None:
        def get(url):
            req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
            with urllib.request.urlopen(req,timeout=18) as r:return json.load(r)
    games={};failures=[]
    requests=[(day,gender,division,f"{API}/soccer-{gender}/d{division}/{day:%Y/%m/%d}/all-conf")
              for day in (today-dt.timedelta(days=1),today)
              for gender in ("men","women") for division in (1,2,3)]
    def fetch_one(request):
        day,gender,division,url=request
        return day,gender,division,get(url)
    with ThreadPoolExecutor(max_workers=6) as pool:
        pending={pool.submit(fetch_one,request):request for request in requests}
        for future in as_completed(pending):
            day,gender,division,_=pending[future]
            try:
                _,_,_,payload=future.result()
                for entry in payload.get("games",[]):
                    item=normalize(entry,gender,division)
                    if item:games[item["match_id"]]=item
            except Exception as exc:
                failures.append({"cohort":f"{gender}-d{division}","day":day.isoformat(),"error":str(exc)[:150]})
    if failures:raise RuntimeError("Incomplete NCAA scoreboard poll: "+json.dumps(failures))
    return {"schema_version":1,"checked_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"NCAA scoreboard via ncaa-api compatibility endpoint","games":sorted(games.values(),key=lambda x:x["match_id"])}
if __name__=="__main__":
    data=collect()
    OUT.write_text(json.dumps(data,indent=2)+"\n")
    print("Published",len(data["games"]),"NCAA live/final score snapshots")

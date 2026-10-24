"""Immutable pregame NCAA soccer forecasts. Never infer kickoff from an unknown field.

Ratings come from calibrated shadow model; probabilities from heldout
cohort-specific draw/ensemble configuration. Until NCAA goals-rate feed is
separately certified, games requiring Poisson blending are not forecast.
"""
import argparse,datetime as dt,json,urllib.request,urllib.error,time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zoneinfo import ZoneInfo

API="https://ncaa-api.henrygd.me/scoreboard"
ET=ZoneInfo("America/New_York")
def now_utc():return dt.datetime.now(dt.timezone.utc)
def parse_start(g):
    # NCAA legacy scoreboards usually contain startTime formatted as HH:MM AM/PM
    # with startDate MM/DD/YYYY. Reject uncertain source timezones.
    date=g.get("startDate"); clock=g.get("startTime")
    if not date or not clock:return None
    # Never invent a start-time timezone: only explicit Eastern-zone stamps pass.
    zone=str(g.get("startTimeZone") or g.get("timeZone") or "").upper().strip()
    clock=str(clock).strip()
    if clock.upper().endswith(" ET"):
        zone="ET";clock=clock[:-3].strip()
    elif clock.upper().endswith(" EST"):
        zone="EST";clock=clock[:-4].strip()
    elif clock.upper().endswith(" EDT"):
        zone="EDT";clock=clock[:-4].strip()
    if zone not in ("ET","EST","EDT","AMERICA/NEW_YORK"):return None
    try:
        naive=dt.datetime.strptime(date+" "+clock,"%m/%d/%Y %I:%M %p")
        local=naive.replace(tzinfo=ET)
        if local.astimezone(ET).replace(tzinfo=None)!=naive:return None
        return local.astimezone(dt.timezone.utc)
    except (ValueError,TypeError,AttributeError):return None

def candidate(game,gender,div,ratings,config,clock):
    g=game.get("game") or {}
    if str(g.get("gameState","")).lower() not in ("pre","scheduled","pregame","pre-game"):return None
    gid=str(g.get("gameID") or "")
    h=g.get("home") or {};a=g.get("away") or {}
    hs=(h.get("names") or {}).get("seo"); ass=(a.get("names") or {}).get("seo")
    start=parse_start(g)
    if not gid.isdecimal() or not hs or not ass or hs==ass or start is None:return None
    if not clock < start <= clock+dt.timedelta(hours=48):return None
    cohort=f"{gender}-d{div}"
    lookup=ratings.get(cohort,{})
    if hs not in lookup or ass not in lookup:return None
    home=lookup[hs];away=lookup[ass]
    ph=1/(1+10**(-(home-away+config["home"])/400))
    return {"match_id":f"{gender}-{gid}","cohort":cohort,"home_team":hs,"away_team":ass,
       "home_name":(h.get("names") or {}).get("short") or hs,
       "away_name":(a.get("names") or {}).get("short") or ass,
       "kickoff_utc":start.isoformat(),"source_game":"https://www.ncaa.com/game/"+gid,
       "p_home":None,"p_draw":None,"p_away":None,"relative_home":ph}

def fetch_json(url):
    request=urllib.request.Request(url,headers={"User-Agent":"SLT-NCAA-Matchup-Forecast/2.0","Accept":"application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=25) as res:doc=json.load(res)
            if not isinstance(doc.get("games"),list):raise ValueError("invalid NCAA schedule response")
            return doc
        except urllib.error.HTTPError as exc:
            if exc.code==404:return {"games":[]}
            if exc.code not in (408,428,429,500,502,503,504) or attempt==2:raise
        except (urllib.error.URLError,TimeoutError):
            if attempt==2:raise
        time.sleep(2**attempt)
    raise RuntimeError("source retry exhausted")

def fetch_scoreboards_with_audit(clock,getter=fetch_json):
    local=clock.astimezone(ET).date()
    jobs=[(gender,div,local+dt.timedelta(days=delta)) for gender in ("men","women") for div in (1,2,3) for delta in range(3)]
    def fetch(job):
        gender,div,day=job;key=f"{gender}-d{div}"
        url=f"{API}/soccer-{gender}/d{div}/{day:%Y/%m/%d}/all-conf"
        try:
            doc=getter(url)
            if not isinstance(doc.get("games"),list):raise ValueError("invalid schedule response")
            return key,doc["games"],None
        except Exception as exc:
            return key,[],{"cohort":key,"date":day.isoformat(),"http_status":getattr(exc,"code",None),"error":str(exc)}
    data={f"{gender}-d{div}":[] for gender in ("men","women") for div in (1,2,3)};errors=[]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for key,games,error in pool.map(fetch,jobs):
            data[key].extend(games)
            if error:errors.append(error)
    return data,errors

def fetch_scoreboards(clock):
    data,errors=fetch_scoreboards_with_audit(clock)
    if errors:raise RuntimeError("NCAA fixture source incomplete: "+json.dumps(errors))
    return data

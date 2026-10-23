"""Fast EuroLeague scorebugs: only poll headers for games near tipoff.

Uses verified model fixtures, recent finals and last published cards to avoid
downloading the whole EuroLeague schedule on every five-minute refresh.
"""
import datetime as dt
import json
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import euroleague_header as header
import euroleague_final_checks as verified

ROOT=pathlib.Path(__file__).resolve().parents[1]
UTC=dt.timezone.utc
MODEL=ROOT/"data/euroleague-model.json"
LIVE=ROOT/"data/euroleague-live.json"

def stamp(value):
    try:
        parsed=dt.datetime.fromisoformat(str(value).replace("Z","+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except (ValueError,TypeError):
        return None

def within(value, now):
    t=stamp(value)
    return t is not None and abs((t-now).total_seconds())<=3*86400

def valid_score(a,b):
    return all(isinstance(x,(int,float)) and not isinstance(x,bool) and 0<=x<=250 for x in (a,b))

def build(model, previous, now=None, get_header=None):
    now=now or dt.datetime.now(UTC)
    get_header=get_header or header.get_header
    if model.get("season")!="2026-27" or len(model.get("rankings",[]))<18:
        raise ValueError("Missing verified current EuroLeague model")
    previous=previous or {}
    clubs={str(x["code"]):x for x in model["rankings"]}
    games={}
    # Keep former live games around until the model confirms their final score.
    for item in previous.get("games",[]):
        if within(item.get("date"),now):
            games[str(item["id"])]=json.loads(json.dumps(item))
    for fixture in model.get("fixtures",[]):
        if not within(fixture.get("date"),now):continue
        key=str(fixture["id"])
        if key not in games:
            games[key]={"id":key,"date":fixture["date"],"status":"scheduled",
                "status_detail":"Scheduled","home":dict(fixture["home"]),
                "away":dict(fixture["away"])}
            games[key]["home"]["score"]=None
            games[key]["away"]["score"]=None
    # Official completed games always trump a previous live score.
    for result in model.get("recent_results",[]):
        if not within(result.get("date"),now):continue
        key=str(result["id"])
        h,a=result["home"],result["away"]
        if not valid_score(*result["score"]):
            raise ValueError("Invalid verified final "+key)
        games[key]={"id":key,"date":result["date"],"status":"final",
            "status_detail":"Final","home":{"code":h,"name":clubs[h]["name"],"logo":clubs[h].get("logo"),"score":result["score"][0]},
            "away":{"code":a,"name":clubs[a]["name"],"logo":clubs[a].get("logo"),"score":result["score"][1]},
            "score_updated_at":model["updated_at"]}
    # Club-confirmed finals take priority over old live states even if the
    # competition-wide results endpoint has not yet marked them played.
    for official in verified.validated(verified.load()):
        g=games.get(str(official["id"]))
        if g is None:continue
        if g["home"]["code"]!=official["home"] or g["away"]["code"]!=official["away"]:
            raise ValueError("Official result club mismatch: "+str(official["id"]))
        if g["status"]=="final" and (g["home"]["score"],g["away"]["score"])!=tuple(official["score"]):
            raise ValueError("Conflicting confirmed final: "+str(official["id"]))
        g["status"]="final"
        g["status_detail"]="Final · club confirmed"
        g["home"]["score"],g["away"]["score"]=official["score"]
        g["score_updated_at"]=g.get("score_updated_at") or now.isoformat()
        g["final_source"]=official["source"]
    responses=0
    refreshed=0
    for g in games.values():
        if g["status"]=="final":continue
        time=stamp(g["date"])
        if time is None:continue
        hours=(now-time).total_seconds()/3600
        if not (-1<=hours<=5):continue
        try:
            raw=get_header(g["id"])
            if not isinstance(raw,dict):
                continue
            responses+=1
            outcome=header.details(raw,g["home"]["code"],g["away"]["code"],g["status"])
            if outcome and outcome["state"]=="live":
                g["status"]="live"
                g["status_detail"]=outcome["detail"] or "In progress"
                g["home"]["score"]=outcome["home"]
                g["away"]["score"]=outcome["away"]
                g["score_updated_at"]=now.isoformat()
                refreshed+=1
            elif raw.get("Live",raw.get("live")) is False and g["status"] in ("live","awaiting_final"):
                home=str(raw.get("CodeTeamA",raw.get("codeTeamA",""))).strip().upper()
                away=str(raw.get("CodeTeamB",raw.get("codeTeamB",""))).strip().upper()
                if home==str(g["home"]["code"]).upper() and away==str(g["away"]["code"]).upper():
                    g["status"]="awaiting_final"
                    g["status_detail"]="Awaiting official final result"
        except (OSError,TimeoutError,ValueError) as exc:
            print("Header check failed for "+str(g["id"])+": "+str(exc),file=sys.stderr)
    for item in games.values():
        if item["status"]=="scheduled":
            item["home"]["score"]=None
            item["away"]["score"]=None
    entries=sorted(games.values(),key=lambda g:(
        0 if g["status"]=="live" else 1 if g["status"]=="scheduled" else 2,
        g["date"],g["id"]))
    latest=now.isoformat() if responses or refreshed else previous.get("updated_at",model["updated_at"])
    return {"season":"2026-27","updated_at":latest,"checked_at":now.isoformat(),
        "source":"EuroLeague per-game Header plus verified Sporting Life & Times model finals",
        "refresh_target_seconds":300,"header_responses":responses,
        "live_scores_refreshed":refreshed,"games":entries}

def main():
    model=json.loads(MODEL.read_text())
    previous=json.loads(LIVE.read_text()) if LIVE.exists() else {}
    result=build(model,previous)
    LIVE.parent.mkdir(parents=True,exist_ok=True)
    temp=LIVE.with_suffix(".json.tmp")
    temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    temp.replace(LIVE)
    print("EuroLeague fast scoreboard:",len(result["games"]),"games,",
          result["header_responses"],"header responses,",
          result["live_scores_refreshed"],"live refreshed")

if __name__=="__main__":
    main()

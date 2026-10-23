"""Publish current EuroLeague scorebugs independently of the Elo publication."""
import datetime as dt
import json
import pathlib
import sys
sys.path.insert(0,"scripts")
import euroleague_model as model

OUT=pathlib.Path("data/euroleague-live.json")
UTC=dt.timezone.utc
def live_status(raw):
    x=str(model.field(raw,"gameStatus","status") or "").strip().lower()
    finished=model.field(raw,"played","isPlayed") is True or x in ("played","result","finished","final","closed")
    if finished:return "final"
    if x in ("live","inprogress","in_progress","playing","started","halftime","half-time","quarter1","quarter2","quarter3","quarter4","overtime","q1","q2","q3","q4","ot"):return "live"
    return "scheduled"

def build():
    now=dt.datetime.now(UTC)
    raw=model.fetch_season("E2026")  # full-season verified fixture identifiers and metadata
    candidates=[g for g in raw if model.clock(g["date"])!=dt.datetime.max.replace(tzinfo=UTC) and abs((model.clock(g["date"])-now).total_seconds())<=3*86400]
    # Request game status/scores directly from the EuroLeague feed, rather than
    # inferring that a scheduled game is underway from its tipoff clock.
    updates={}
    for offset in range(0,1500,100):
        page=model.get(model.BASE+"E2026"+f"/games?limit=100&offset={offset}")
        rows=model.field(page,"data","games","items")
        if not isinstance(rows,list):raise ValueError("Unexpected live game response")
        for item in rows:
            key=str(model.field(item,"gameCode","code","id") or "")
            if key:updates[key]=item
        reported=model.field(page,"total","totalCount")
        if isinstance(reported,int) and len(updates)>=reported:break
        if len(rows)<100:break
    entries=[]
    for g in candidates:
        record=updates.get(g["id"])
        if record is None:raise ValueError("Missing game in live status source: "+g["id"])
        status=live_status(record)
        h,a=model.team(record,"local"),model.team(record,"road")
        scores_ready=all(isinstance(x,(int,float)) and not isinstance(x,bool) and x>=0 for x in (h["score"],a["score"]))
        if status=="final" and not scores_ready:raise ValueError("Final missing score "+g["id"])
        # Scheduled placeholders (0-0) are NEVER displayed as real game scores.
        score_allowed=scores_ready and status in ("live","final")
        entries.append({"id":g["id"],"date":g["date"],"status":status,
                        "status_detail":str(model.field(record,"gameStatus","status") or ""),
                        "home":{"code":h["code"],"name":h["name"],"logo":h["logo"],"score":h["score"] if score_allowed else None},
                        "away":{"code":a["code"],"name":a["name"],"logo":a["logo"],"score":a["score"] if score_allowed else None}})
    entries.sort(key=lambda e:(0 if e["status"]=="live" else 1 if e["status"]=="scheduled" else 2,e["date"],e["id"]))
    return {"season":"2026-27","updated_at":now.isoformat(),"source":"EuroLeague public v2 games feed","refresh_target_seconds":300,"games":entries}

if __name__=="__main__":
    result=build()
    if not result["games"]:raise ValueError("No EuroLeague scorebugs in rolling game window")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    print("Published",len(result["games"]),"EuroLeague game scorebugs")

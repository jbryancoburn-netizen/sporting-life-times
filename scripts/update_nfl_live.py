#!/usr/bin/env python3
"""Small, sourced NFL game-day feed. No Elo recalculation or placeholder statistics."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from build_nfl_edition import API, META, parse_box, parse_event, request

ROOT=Path(__file__).resolve().parents[1]
EDITION=ROOT/"data/nfl-2026-edition.json"
OUTPUT=ROOT/"data/nfl-live.json"
TZ=ZoneInfo("America/New_York")

def load(path,default):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except (OSError,ValueError): return default

def enrich(event,parsed):
    comp=(event.get("competitions") or [{}])[0]
    for raw in comp.get("competitors") or []:
        side=raw.get("homeAway")
        if side not in ("away","home"): continue
        scores=[]
        for idx,line in enumerate(raw.get("linescores") or []):
            value=line.get("displayValue",line.get("value"))
            try: value=int(float(value))
            except (ValueError,TypeError): value=None
            scores.append({"period":idx+1,"score":value})
        parsed[side]["linescores"]=scores
    situation=comp.get("situation") or {}
    possession=str(situation.get("possession") or "")
    parsed["possession"]=possession if possession in {parsed["away"]["id"],parsed["home"]["id"]} else None
    last=situation.get("lastPlay") or {}
    parsed["last_play"]=str(last.get("text") or "")[:330] or None
    try:
        parsed["down_distance"]=str(situation.get("downDistanceText") or "")[:80] or None
    except (TypeError,ValueError):
        parsed["down_distance"]=None
    return parsed

def main():
    now=dt.datetime.now(dt.timezone.utc)
    local=now.astimezone(TZ).date()
    edition=load(EDITION,{})
    if edition.get("season")!=2026 or len(edition.get("games") or [])!=272:
        raise RuntimeError("Refusing NFL live publication without certified 272-game season ledger")
    canonical={g["id"]:g for g in edition["games"]}
    dates=[(local+dt.timedelta(days=d)).strftime("%Y%m%d") for d in (-1,0,1)]
    all_events={}
    def fetch_day(day):
        raw=request(API+"scoreboard?"+urlencode({"dates":day,"limit":50}))
        if not isinstance(raw.get("events"),list):
            raise ValueError("NFL scoreboard missing event list on "+day)
        return raw["events"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for events in pool.map(fetch_day,dates):
            for e in events:
                game=parse_event(e)
                if game and game["id"] in canonical:
                    base=canonical[game["id"]]
                    if base["state"]=="post" and game["state"]!="post":
                        continue
                    if game["away"]["id"]!=base["away"]["id"] or game["home"]["id"]!=base["home"]["id"]:
                        raise RuntimeError("NFL live opponent identity conflict: "+game["id"])
                    all_events[game["id"]]=enrich(e,game)
    if not all_events:
        raise RuntimeError("No certified NFL games in nearby scoreboard; refusing empty overwrite")
    ordered=sorted(all_events.values(),key=lambda x:(x["date"],x["id"]))
    active=[g for g in ordered if g["state"]=="in"]
    boxes={}
    # Per-game box scores are source data; do not invent a leader when ESPN has no box.
    if active:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            requests={pool.submit(parse_box,g["id"]):g["id"] for g in active}
            for fut in concurrent.futures.as_completed(requests):
                try: boxes[requests[fut]]=fut.result()
                except (RuntimeError,ValueError) as error:
                    print("Live statistical box unavailable",requests[fut],str(error)[:180])
    payload={"season":2026,"updated_at":now.isoformat(),"source":"ESPN NFL scoreboard and summaries; source-backed live scores only",
        "elo_policy":"USRS Elo updates after certified finals in the main season ledger, never during a live game",
        "dates":dates,"games":ordered,"boxes":boxes,
        "coverage":{"games":len(ordered),"active":len(active),"live_boxes":len(boxes)}}
    prior=load(OUTPUT,{})
    def changed(x):
        y=dict(x)
        y.pop("updated_at",None)
        return y
    if prior and changed(prior)==changed(payload):
        try: age=(now-dt.datetime.fromisoformat(prior["updated_at"])).total_seconds()
        except (ValueError,KeyError,TypeError): age=999999
        if age<(420 if active else 2700):
            print("Live NFL feed unchanged; no unnecessary Git commit")
            return
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("Live NFL published",len(ordered),"nearby games;",len(active),"live;",len(boxes),"live boxes")

if __name__=="__main__":
    main()

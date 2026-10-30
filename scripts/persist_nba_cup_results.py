#!/usr/bin/env python3
"""Persist NBA Cup finals from the published NBA game-center ledger. Safe to rerun."""
import json, pathlib, datetime
root=pathlib.Path(__file__).resolve().parents[1]
cup=root/"data/nba-cup-2026.json"; source=root/"data/nba-game-center.json"
doc=json.loads(cup.read_text()); feed=json.loads(source.read_text())
matches={}
for game in feed.get("games",[]):
    if game.get("state")!="post":continue
    sides={x.get("home_away"):x for x in game.get("teams",[])}
    a,h=sides.get("away"),sides.get("home")
    if not a or not h or not game.get("date"):continue
    try:
        day=datetime.datetime.fromisoformat(game["date"].replace("Z","+00:00")).astimezone(datetime.timezone(datetime.timedelta(hours=-4))).date().isoformat()
        key=f'{day}|{a["code"]}|{h["code"]}'
        ass,hss=int(a["score"]),int(h["score"])
        if ass!=hss:matches[key]={"away_score":ass,"home_score":hss,"game_id":game.get("id"),"source":"data/nba-game-center.json","source_date":game.get("date")}
    except (ValueError,KeyError,TypeError):pass
changed=0
for game in doc["fixtures"]:
    result=matches.get(game["key"])
    if result and game.get("result")!=result:
        if game.get("result") and (game["result"].get("home_score"),game["result"].get("away_score"))!=(result["home_score"],result["away_score"]):
            print("CONFLICT",game["key"]);continue
        game["result"]=result;changed+=1
if changed:
    doc["results_synced_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    cup.write_text(json.dumps(doc,indent=2)+"\n")
print("New or updated persisted results:",changed,"Completed:",sum(bool(f.get("result")) for f in doc["fixtures"]))

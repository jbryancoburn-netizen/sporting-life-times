#!/usr/bin/env python3
"""Collect NCAA-origin daily men's D1 scoreboards, retaining source failures."""
import argparse,json,urllib.request
from datetime import date,timedelta
from pathlib import Path

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=20) as r:
        result=json.loads(r.read(5000000))
    if not isinstance(result.get("games"),list):raise ValueError("Invalid games array")
    return result

def collect(start,days,fetcher=fetch):
    results={};failed=[];checked=[]
    for n in range(days):
        day=start+timedelta(days=n)
        url="https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/"+day.strftime("%Y/%m/%d")+"/all-conf"
        try:
            payload=fetcher(url)
            checked.append(day.isoformat())
            for wrapper in payload["games"]:
                game=wrapper.get("game",wrapper)
                gid=str(game.get("gameID") or game.get("gameId") or "")
                if not gid:raise ValueError("Missing game ID")
                record={"id":gid,"day":day.isoformat(),"source_url":url,"game":game}
                if gid in results and results[gid]!=record:raise ValueError("Conflicting duplicate game")
                results[gid]=record
        except Exception as exc:
            failed.append({"day":day.isoformat(),"error":str(exc)[:160]})
    return {"season":"2026-27","provider":"ncaa-origin bridge","checked_days":checked,
       "failed_days":failed,"coverage_complete":not failed,
       "games":sorted(results.values(),key=lambda x:(x["day"],x["id"])),
       "release_status":"source candidates only; venue and identity verification required"}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--start",default=date.today().isoformat())
    p.add_argument("--days",type=int,default=2)
    p.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-source-candidates.json"))
    a=p.parse_args()
    if not 1<=a.days<=7:p.error("days must be between 1 and 7")
    result=collect(date.fromisoformat(a.start),a.days)
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(result,indent=2)+"\n")
    print("NCAA candidate games:",len(result["games"]),"failed dates:",len(result["failed_days"]))
    if result["failed_days"]:raise SystemExit("Incomplete feed; see source candidate JSON")
if __name__=="__main__":main()

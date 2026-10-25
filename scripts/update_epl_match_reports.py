#!/usr/bin/env python3
"""Publish sourced EPL match details independently of the Elo result pipeline."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
from urllib.request import urlopen, Request

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
DETAILS=DATA/"epl-match-reports.json"
SOURCE="https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event="
def fetch(game):
    gid=str(game["fixture_id"])
    if not gid.isdecimal():raise ValueError("Invalid fixture ID")
    with urlopen(Request(SOURCE+gid,headers={"User-Agent":"Mozilla/5.0","Accept":"application/json"}),timeout=17) as r:
        raw=json.load(r)
    box=raw.get("boxscore") or {}
    teams=[]
    for t in box.get("players",[]):
        teams.append({"name":t.get("team",{}).get("displayName"),"athletes":t.get("statistics",[])})
    teamstats=[]
    for t in box.get("teams",[]):
        teamstats.append({"team":t.get("team",{}).get("displayName"),"statistics":t.get("statistics",[])})
    events=[]
    for e in (raw.get("keyEvents") or raw.get("plays") or [])[:150]:
        events.append({"clock":e.get("clock",{}).get("displayValue"),"text":e.get("text"),"type":e.get("type",{}).get("text"),"team":e.get("team",{}).get("displayName")})
    return gid,{"home":game["home"],"away":game["away"],"home_score":game["home_score"],"away_score":game["away_score"],"kickoff_utc":game["kickoff_utc"],"teams":teamstats,"players":teams,"events":events,"source_url":"https://www.espn.com/soccer/match/_/gameId/"+gid}
def main():
    feed=json.loads((DATA/"epl-match-center.json").read_text())
    finals=feed.get("recent_results",[])[:18]
    old=json.loads(DETAILS.read_text()) if DETAILS.exists() else {"matches":{}}
    matches=old.get("matches",{})
    successful=0;failed={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures={pool.submit(fetch,g):str(g["fixture_id"]) for g in finals}
        for fut in concurrent.futures.as_completed(futures):
            gid=futures[fut]
            try:
                key,report=fut.result()
                matches[key]=report
                successful+=1
            except Exception as exc:failed[gid]=str(exc)[:150]
    if not successful and not matches:raise RuntimeError("No match reports available; refusing empty publication")
    output={"updated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"ESPN event summary; third-party match facts only, not Elo","matches":matches,"fetch_status":{"successful":successful,"failed":failed}}
    DETAILS.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"reports":len(matches),"newly_verified":successful,"failed":len(failed)}))
if __name__=="__main__":main()

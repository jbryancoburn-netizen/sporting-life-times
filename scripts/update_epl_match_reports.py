#!/usr/bin/env python3
"""Publish sourced EPL match details independently of the Elo result pipeline."""
import concurrent.futures
import datetime as dt
import json
import re
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
    # Reject mismatched events instead of attaching statistics to the wrong result.
    event_id=str(raw.get("header",{}).get("id") or raw.get("header",{}).get("competitions",[{}])[0].get("id") or gid)
    if event_id!=gid:raise ValueError("Event ID mismatch: "+event_id)
    teams=[]
    for t in box.get("players",[]):
        teams.append({"name":t.get("team",{}).get("displayName"),"athletes":t.get("statistics",[])})
    teamstats=[]
    for t in box.get("teams",[]):
        teamstats.append({"team":t.get("team",{}).get("displayName"),"statistics":t.get("statistics",[])})
    events=[]
    for e in (raw.get("keyEvents") or raw.get("plays") or [])[:150]:
        events.append({"clock":e.get("clock",{}).get("displayValue"),"text":e.get("text"),"type":e.get("type",{}).get("text"),"team":e.get("team",{}).get("displayName")})
    if not (teamstats or teams or events):raise ValueError("Event summary contains no detailed statistics or events")
    return gid,{"home":game["home"],"away":game["away"],"home_score":game["home_score"],"away_score":game["away_score"],"kickoff_utc":game["kickoff_utc"],"teams":teamstats,"players":teams,"events":events,"source_url":"https://www.espn.com/soccer/match/_/gameId/"+gid}
def player_snapshot(matches):
    """Event-derived leaders for only the stored match-report window, not season totals."""
    goals={};assists={};own_goals=0
    for match in matches.values():
        for event in match.get("events",[]):
            kind=(event.get("type") or "").lower()
            description=event.get("text") or ""
            if "own goal" in kind:
                own_goals+=1
                continue
            if not (kind.startswith("goal") or kind=="penalty - scored"):
                continue
            scorer=re.search(r"\\.\\s+(.+?)\\s+\\(([^()]+)\\)\\s+(?:right footed|left footed|header|converts|scores|penalty)",description,re.I)
            if scorer:
                key=(scorer.group(1).strip(),scorer.group(2).strip())
                goals[key]=goals.get(key,0)+1
            helper=re.search(r"Assisted by (.+?)(?: with | following |\\.|$)",description,re.I)
            if helper and event.get("team"):
                key=(helper.group(1).strip(),event["team"])
                assists[key]=assists.get(key,0)+1
    def sorted_rows(values,label):
        return [{"player":p,"team":t,label:v} for (p,t),v in sorted(values.items(),key=lambda row:(-row[1],row[0][0]))]
    return {"scope":"published_match_reports_only","matches_covered":len(matches),
            "goals":sorted_rows(goals,"count"),"assists":sorted_rows(assists,"count"),
            "own_goals_not_counted":own_goals,
            "note":"Event-derived from the published match-report window, not official season leaderboards; unresolved player names are excluded."}
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
    if not successful and not matches:raise RuntimeError("No detailed match reports available; refusing empty publication")
    output={"player_snapshot":player_snapshot(matches),"updated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"ESPN event summary; third-party match facts only, not Elo","matches":matches,"fetch_status":{"successful":successful,"failed":failed}}
    DETAILS.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"reports":len(matches),"newly_verified":successful,"failed":len(failed)}))
if __name__=="__main__":main()

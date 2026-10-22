"""Check whether published EPL forecasts join the live Match Center fixture IDs.

Run in site CI only when a current forecast export exists. Do not invent
matches or assume that every 28-day future fixture appears on today's board.
"""
import json
from pathlib import Path

def check(forecast_path="data/epl-match-center.json",scoreboard_path="scoreboards.json"):
    forecast=json.loads(Path(forecast_path).read_text())
    board=json.loads(Path(scoreboard_path).read_text())
    league=next((l for l in board.get("leagues",[]) if l.get("league")=="Premier League"),None)
    if not league:raise ValueError("Premier League scoreboard missing")
    known={str(g["id"]):g for g in league.get("games",[]) if g.get("id")}
    predictions={str(g["fixture_id"]):g for g in forecast["fixtures"]}
    shared=sorted(set(known)&set(predictions))
    mismatches=[]
    for fid in shared:
        g=known[fid];p=predictions[fid]
        team_ids={str(t.get("id")) for t in g.get("teams",[])}
        predicted_ids={str(p["home"]["id"]),str(p["away"]["id"])}
        if team_ids!={"None"} and None not in team_ids and team_ids!=predicted_ids:
            mismatches.append(fid)
        if str(g.get("date",""))[:16]!=str(p["kickoff_utc"])[:16]:
            # ISO timestamps may differ by timezone formatting; compare UTC instants.
            from datetime import datetime
            try:
                a=datetime.fromisoformat(g["date"].replace("Z","+00:00"))
                b=datetime.fromisoformat(p["kickoff_utc"].replace("Z","+00:00"))
                if a!=b:mismatches.append(fid)
            except ValueError:mismatches.append(fid)
    if mismatches:raise ValueError("EPL scoreboard/forecast fixture mismatch: "+",".join(sorted(set(mismatches))))
    if not shared:raise ValueError("no EPL forecast IDs match the current scoreboard")
    return {"published_forecasts":len(predictions),"scoreboard_epl_games":len(known),"matching_fixture_ids":len(shared),"status":"passed"}
if __name__=="__main__":
    print(json.dumps(check(),indent=2))

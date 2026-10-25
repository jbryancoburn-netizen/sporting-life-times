"""Collect NCAA D-I men's soccer historical finals independently of Elo's pinned ledger.
Never feed these games back through the Elo replay: the baseline already contains them.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from update_college_soccer_elo import API, scoreboard, normalized_final

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/college-soccer-season-finals-2026.json"
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--start",default="2026-08-01")
    p.add_argument("--end",default=dt.date.today().isoformat())
    a=p.parse_args()
    start,end=dt.date.fromisoformat(a.start),dt.date.fromisoformat(a.end)
    if end<start or (end-start).days>150: raise ValueError("invalid backfill interval")
    previous=json.loads(OUT.read_text()) if OUT.exists() else {"results":[],"checked_dates":[]}
    games={g["match_id"]:g for g in previous.get("results",[])}
    dates=set(previous.get("checked_dates",[]))
    checked=0
    day=start
    while day<=end:
        if day.isoformat() not in dates:
            url=f"{API}/soccer-men/d1/{day:%Y/%m/%d}/all-conf"
            payload=scoreboard(url)
            for raw in payload["games"]:
                g=normalized_final(raw,"men",day)
                if not g:continue
                prior=games.get(g["match_id"])
                if prior is not None and prior!=g:raise ValueError("conflicting game ID "+g["match_id"])
                games[g["match_id"]]=g
            dates.add(day.isoformat());checked+=1
        day+=dt.timedelta(days=1)
    payload={"schema_version":1,"season":2026,"source":"NCAA scoreboard by date, all conferences, Division I men",
             "checked_dates":sorted(dates),"results":sorted(games.values(),key=lambda g:(g["date"],g["match_id"])),
             "coverage_complete_for_requested_range":all((start+dt.timedelta(days=i)).isoformat() in dates for i in range((end-start).days+1))}
    OUT.write_text(json.dumps(payload,sort_keys=True,separators=(",",":"))+"\n")
    print("Historical dates checked:",checked,"total finals:",len(games),"range complete:",payload["coverage_complete_for_requested_range"])
if __name__=="__main__":main()

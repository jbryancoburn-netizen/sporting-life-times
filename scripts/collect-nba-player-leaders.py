#!/usr/bin/env python3
"""Fetch ESPN's published NBA individual leaderboards. Never invent player stats."""
import json
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import urlopen,Request
root=Path(__file__).resolve().parents[1]
url="https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2027&seasontype=2&limit=100"
with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"application/json"}),timeout=18) as f:
    d=json.load(f)
print("ESPN leader payload root:",list(d)[:15])
# Validate actual returned schema; publishing unrecognized or empty statistics is forbidden.
cats=d.get("categories") or []
records=[]
for category in cats:
    label=category.get("name") or category.get("displayName") or category.get("abbreviation") or ""
    athletes=category.get("leaders") or category.get("athletes") or []
    for item in athletes:
        athlete=item.get("athlete") or {}
        person=athlete.get("displayName") or athlete.get("fullName") or item.get("displayName")
        team=(item.get("team") or athlete.get("team") or {})
        teamcode=team.get("abbreviation") if isinstance(team,dict) else ""
        stats=item.get("statistics") or []
        for st in stats:
            if not isinstance(st,dict):continue
            name=(st.get("abbreviation") or st.get("name") or "").lower()
            val=st.get("value")
            if person and name in ("avg","ppg","rpg","apg","spg","bpg","points","rebounds","assists","steals","blocks") and isinstance(val,(int,float)):
                records.append({"category":label,"stat":name,"player":person,"team":teamcode or "", "value":val})
if len(records)<15: 
    print("ESPN returned unrecognized leaderboard structure; retaining existing snapshot")
    raise SystemExit(0)
out={"updated_at":datetime.now(timezone.utc).isoformat(),"season":"2026-27","source":"ESPN NBA statistics by athlete","url":url,"rows":records}
(root/"data/nba-player-leaders.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
print("Published",len(records),"verified leader values")

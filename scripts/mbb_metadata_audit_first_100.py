#!/usr/bin/env python3
"""Audit first 100 MBB school schedules: report only, no invented corrections."""
import json,pathlib,collections,re
root=pathlib.Path(__file__).resolve().parents[1]
teams=json.loads((root/"data/ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
selected=[t for t in teams if t.get("espn_id")][:100]
assert len(selected)==100
rows=[]
for t in selected:
 p=root/"data/mbb-schedules-2026-27"/(str(t["espn_id"])+".json")
 if not p.exists():
  rows.append({"team":t["name"],"id":t["espn_id"],"status":"missing"});continue
 d=json.loads(p.read_text())
 events=d.get("events") or []
 stats=collections.Counter()
 for e in events:
  c=(e.get("competitions") or [{}])[0]
  participants=c.get("competitors") or []
  selfrow=next((a for a in participants if str((a.get("team") or {}).get("id"))==str(t["espn_id"])),{})
  opp=next((a for a in participants if a is not selfrow),{})
  venue=(c.get("venue") or {}).get("fullName") or ""
  if not venue or re.search("Choose A Location|All Games Home|Select Location",venue,re.I):stats["missing_arena"]+=1
  if selfrow.get("homeAway") not in ("home","away") and not e.get("site_verified"):stats["unverified_home_away"]+=1
  if not e.get("official_time") or re.search("TBA",str(e.get("official_time")),re.I):stats["missing_tipoff"]+=1
  if not c.get("broadcasts") and not e.get("broadcasts"):stats["missing_network"]+=1
  if not (opp.get("team") or {}).get("logo"):stats["missing_opponent_logo"]+=1
  if not (opp.get("team") or {}).get("id"):stats["missing_opponent_id"]+=1
 rows.append(dict(team=t["name"],id=t["espn_id"],status="audited",games=len(events),official_source=bool(d.get("verified_from_school")),**stats))
fields=["missing_arena","unverified_home_away","missing_tipoff","missing_network","missing_opponent_logo","missing_opponent_id"]
report=dict(scope="first 100 teams in crosswalk",status="field completeness audit; not source verification",schools_examined=100,files_present=sum(r["status"]=="audited" for r in rows),files_missing=sum(r["status"]=="missing" for r in rows),games=sum(r.get("games",0) for r in rows),totals={k:sum(r.get(k,0) for r in rows) for k in fields},schools=rows)
p=root/"data/mbb-first-100-metadata-audit-20261027.json"
p.write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({k:v for k,v in report.items() if k!="schools"},indent=2))

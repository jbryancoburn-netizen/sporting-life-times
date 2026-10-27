#!/usr/bin/env python3
"""One-time, bounded 100-school MBB schedule cleanup. No remote scraping or fabricated data."""
import json, re, pathlib, datetime, subprocess
root=pathlib.Path(__file__).resolve().parents[1]
cross=json.loads((root/"data/ncaam-2026-27-espn-team-crosswalk.json").read_text())
teams=[t for t in cross["teams"] if t.get("espn_id")][60:160]
assert len(teams)==100, f"Expected 100 schools, got {len(teams)}"
results=[]
badvenue=re.compile(r"Choose A Location|All Games Home|Select Location",re.I)
def score(e):
    c=(e.get("competitions") or [{}])[0]
    venue=(c.get("venue") or {}).get("fullName","")
    return (4 if venue and not badvenue.search(venue) else 0)+(2 if e.get("official_time") else 0)+(1 if c.get("broadcasts") else 0)
for t in teams:
    path=root/"data/mbb-schedules-2026-27"/(str(t["espn_id"])+".json")
    if not path.exists():
        results.append(dict(team=t["name"],id=t["espn_id"],status="MISSING"));continue
    data=json.loads(path.read_text())
    before=len(data.get("events") or [])
    unique={}; invalid=0; invalid_venues=0
    for event in data.get("events") or []:
        comps=event.get("competitions") or []
        if not event.get("date") or not comps or len(comps[0].get("competitors") or [])<2:
            invalid+=1;continue
        c=comps[0];venue=(c.get("venue") or {}).get("fullName","")
        if badvenue.search(venue):
            c.pop("venue",None);invalid_venues+=1
        own=str(t["espn_id"])
        opponent=next((p for p in c.get("competitors",[]) if str((p.get("team") or {}).get("id"))!=own),{})
        ot=opponent.get("team") or {}
        key=(event["date"][:10],str(ot.get("id") or ot.get("displayName") or event.get("name") or "").strip().lower())
        if key not in unique or score(event)>score(unique[key]):unique[key]=event
    data["events"]=sorted(unique.values(),key=lambda x:x["date"])
    data["audit_2026_10_27"]={"batch":"mbb-100-60-159","source_integrity":"Not fully verified; imported neutral site flags and absent TV remain unconfirmed","events_before":before,"events_after":len(data["events"]),"discarded_invalid":invalid,"discarded_duplicates":before-invalid-len(data["events"]),"removed_site_filter_text":invalid_venues}
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n")
    results.append(dict(team=t["name"],id=t["espn_id"],status="UPDATED",before=before,after=len(data["events"]),removed=before-len(data["events"]),invalid_venues=invalid_venues))
report=root/"data/mbb-100-schedule-audit-20261027.json"
report.write_text(json.dumps({"batch_range":"crosswalk[60:160]","date":"2026-10-27","processed":len(results),"updated":sum(x["status"]=="UPDATED" for x in results),"missing":sum(x["status"]=="MISSING" for x in results),"total_removed":sum(x.get("removed",0) for x in results),"schools":results},indent=2)+"\n")
print(report.read_text()[:3000])

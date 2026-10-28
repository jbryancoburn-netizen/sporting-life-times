#!/usr/bin/env python3
"""Audit impossible multiuse of Sidearm evidence. No schedule mutation."""
import json,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1]/"data"
cross=json.loads((root/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
out=[];tot=collections.Counter()
for team in cross:
 tid=str(team.get("espn_id") or "");p=root/"mbb-schedules-2026-27"/(tid+".json")
 if not p.exists():continue
 d=json.loads(p.read_text());games=[x for x in d.get("events",[]) if x.get("site_verified_via")=="official_sidearm_card_jsonld_and_venue"]
 keys=collections.defaultdict(list)
 for e in games:
  ps=(e.get("competitions") or [{}])[0].get("competitors") or []
  other=next((x for x in ps if str((x.get("team") or {}).get("id"))!=tid),{})
  op=str((other.get("team") or {}).get("id") or (other.get("team") or {}).get("displayName") or e.get("name"))
  key=(str(e.get("date"))[:10],op)
  keys[key].append(str(e.get("id")))
 collisions=[{"date":k[0],"opponent":k[1],"events":v} for k,v in keys.items() if len(v)>1]
 tot["sidearm_verified_records"]+=len(games);tot["colliding_groups"]+=len(collisions)
 tot["colliding_records"]+=sum(len(x["events"]) for x in collisions)
 if collisions:out.append({"school":team["name"],"id":tid,"sidearm_records":len(games),"collisions":collisions})
report={"summary":dict(tot),"schools_with_collisions":len(out),"details":out,
"warning":"This detects duplicate event keys, but does not prove unique source game use; manual or source-id audit remains required."}
(root/"mbb-sidearm-duplicate-validation.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({k:v for k,v in report.items() if k!="details"},indent=2))

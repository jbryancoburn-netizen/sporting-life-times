#!/usr/bin/env python3
"""Quarantine ambiguous Sidearm matches, preserve records, and recount verification."""
import json,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1]/"data"
cross=json.loads((root/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
stats=collections.Counter();detail=[]
for team in cross:
 tid=str(team.get("espn_id") or "");p=root/"mbb-schedules-2026-27"/(tid+".json")
 if not p.exists():continue
 d=json.loads(p.read_text());groups=collections.defaultdict(list)
 for e in d.get("events",[]):
  if e.get("site_verified_via")!="official_sidearm_card_jsonld_and_venue":continue
  ps=(e.get("competitions") or [{}])[0].get("competitors") or []
  other=next((x for x in ps if str((x.get("team") or {}).get("id"))!=tid),{})
  opponent=str((other.get("team") or {}).get("id") or (other.get("team") or {}).get("displayName") or e.get("name"))
  groups[(str(e.get("date"))[:10],opponent)].append(e)
 changed=0
 for key,entries in groups.items():
  if len(entries)<=1:continue
  stats["duplicate_groups_quarantined"]+=1
  for e in entries:
   e["site_verified"]=False
   e["site_verification_status"]="quarantined_duplicate_sidearm_match"
   e["site_quarantine_reason"]="Multiple newspaper records mapped to the same official date and opponent; cannot uniquely certify any match."
   e.pop("site_verified_via",None)
   e.pop("site_source_url",None)
   changed+=1
 if changed:
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
  stats["schools_changed"]+=1;stats["records_quarantined"]+=changed
  detail.append({"school":team["name"],"records_quarantined":changed})
out={"summary":dict(stats),"details":detail,"policy":"Ambiguous matches have site_verified=false; existing schedule records retained for investigation."}
(root/"mbb-sidearm-quarantine-report.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))

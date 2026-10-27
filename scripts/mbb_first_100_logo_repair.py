#!/usr/bin/env python3
"""Resolve exact/unique Division I opponent aliases for the first 100 MBB schedules."""
import json,pathlib,re,collections
root=pathlib.Path(__file__).resolve().parents[1]
teams=json.loads((root/"data/ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
def key(v):return re.sub(r"[^a-z0-9]","",str(v or "").lower())
aliases=collections.defaultdict(set)
byid={}
for t in teams:
 eid=str(t.get("espn_id") or "")
 if not eid:continue
 byid[eid]=t
 for x in (t.get("name"),t.get("espn_name")):
  if x:aliases[key(x)].add(eid)
lookup={k:next(iter(v)) for k,v in aliases.items() if len(v)==1 and k}
rows=[]
for t in [t for t in teams if t.get("espn_id")][:100]:
 path=root/"data/mbb-schedules-2026-27"/(str(t["espn_id"])+".json")
 if not path.exists():continue
 d=json.loads(path.read_text());fixed=0;unresolved=0
 for e in d.get("events") or []:
  competitors=(e.get("competitions") or [{}])[0].get("competitors") or []
  opp=next((p for p in competitors if str((p.get("team") or {}).get("id"))!=str(t["espn_id"])),None)
  if opp is None:continue
  obj=opp.get("team") or {}
  if obj.get("logo") and obj.get("id"):continue
  label=obj.get("displayName") or obj.get("name") or e.get("name")
  match=lookup.get(key(label))
  if not match or match==str(t["espn_id"]):unresolved+=1;continue
  if obj.get("id") and str(obj["id"])!=match:unresolved+=1;continue
  if not obj.get("id"):obj["id"]=match
  if not obj.get("logo"):obj["logo"]="https://a.espncdn.com/i/teamlogos/ncaa/500/"+match+".png"
  opp["team"]=obj
  fixed+=1
 if fixed:
  d["opponent_identity_audit"]={"method":"unique normalized exact names in existing Division I ESPN crosswalk","resolved":fixed,"unresolved":unresolved}
  path.write_text(json.dumps(d,ensure_ascii=False,separators=(",",":"))+"\n")
 rows.append({"team":t["name"],"id":t["espn_id"],"resolved":fixed,"unresolved":unresolved})
result={"schools":len(rows),"files_changed":sum(r["resolved"]>0 for r in rows),"opponent_id_logo_repaired":sum(r["resolved"] for r in rows),"unresolved":sum(r["unresolved"] for r in rows),"method":"unique exact crosswalk identity, no fuzzy guess","teams":rows}
(root/"data/mbb-first-100-opponent-logo-repair-20261027.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({k:v for k,v in result.items() if k!="teams"}))

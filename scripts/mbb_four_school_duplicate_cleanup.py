#!/usr/bin/env python3
"""Conservative duplicate schedule cleanup for four identified schools.
Keep best source-rich canonical entry; archive removed entries; never erase
distinct games with conflicting locations or tipoffs.
"""
import json,pathlib,collections,copy
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
IDS=("2065","325","2142","2154")
out={"schools":[],"totals":collections.Counter(),"archived_duplicates":[]}
for tid in IDS:
 p=ROOT/"mbb-schedules-2026-27"/f"{tid}.json"
 d=json.loads(p.read_text())
 events=d["events"]; groups=collections.defaultdict(list)
 for idx,e in enumerate(events):
  com=(e.get("competitions") or [{}])[0]
  ps=com.get("competitors") or []
  op=next((x for x in ps if str((x.get("team") or {}).get("id"))!=tid),{})
  t=op.get("team") or {}
  key=(str(e.get("date") or "")[:10],str(t.get("id") or t.get("displayName") or e.get("name") or "").lower().strip())
  groups[key].append((idx,e))
 result={"id":tid,"before":len(events),"removed":0,"collision_groups":0,"conflicting_groups":0,"after":None}
 keep=set(range(len(events)))
 for key,rows in groups.items():
  if len(rows)<2:continue
  result["collision_groups"]+=1
  def info(e):
   venue=(e.get("competitions") or [{}])[0].get("venue") or {}
   return (str(venue.get("arenaName") or "").strip().lower(),str(e.get("official_school_time") or "").strip().lower())
  # Site conflicts never automatically removed, except if one side is unverified,
  # and all other source-specific details agree.
  unique_nonempty_venues={info(e)[0] for _,e in rows if info(e)[0]}
  unique_nonempty_times={info(e)[1] for _,e in rows if info(e)[1]}
  sites={next((x.get("homeAway") for x in (e.get("competitions") or [{}])[0].get("competitors",[]) if str((x.get("team") or {}).get("id"))==tid),"neutral") for _,e in rows if e.get("site_verified")}
  if len(unique_nonempty_venues)>1 or len(unique_nonempty_times)>1 or len(sites)>1:
   result["conflicting_groups"]+=1
   continue
  def rank(row):
   _,e=row
   com=(e.get("competitions") or [{}])[0]
   v=com.get("venue") or {}
   return (int(e.get("site_verified") is True),int(bool(v.get("arenaName"))),
     int(bool(e.get("site_source_url"))),int(bool(e.get("official_school_time"))),-row[0])
  bestidx,best=max(rows,key=rank)
  # Do not keep a bogus verification unless source game identifier is present
  # or the original game was previously independently verified.
  for idx,e in rows:
   if idx==bestidx:continue
   keep.remove(idx);result["removed"]+=1
   out["archived_duplicates"].append({"school_id":tid,"duplicate_id":e.get("id"),"canonical_id":best.get("id"),"event":e})
  if best.get("site_verification_status")=="quarantined_duplicate_sidearm_match":
   best["site_verified"]=False
   best["site_verification_status"]="requires_unique_official_game_rematch"
 d["events"]=[e for idx,e in enumerate(events) if idx in keep]
 result["after"]=len(d["events"]);out["schools"].append(result)
 for key in ("removed","collision_groups","conflicting_groups"):out["totals"][key]+=result[key]
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
out["totals"]=dict(out["totals"])
(ROOT/"mbb-four-school-duplicate-cleanup.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"schools":out["schools"],"totals":out["totals"]},indent=2))

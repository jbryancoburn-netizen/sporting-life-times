#!/usr/bin/env python3
"""Build the newspaper's single authoritative, updateable MBB master document.
Reads existing school-source snapshots. No network, scraping, paid API, or new dependencies.
Run: python scripts/mbb_build_university_master.py
"""
import csv,json,pathlib,collections,datetime
root=pathlib.Path(__file__).resolve().parents[1]
data=root/"data"
cross=json.loads((data/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
registry=json.loads((data/"mbb-arena-registry.json").read_text())["teams"]
columns=["school","school_id","ncaa_id","date","opponent","opponent_id","home_away_neutral","site_verified","site_review_status","arena","location","registered_home_arena","official_tipoff","broadcast","official_school_source","official_game_id"]
results=[];schools=[];summary=collections.Counter()
for team in cross:
 sid=str(team.get("espn_id") or "")
 p=data/"mbb-schedules-2026-27"/(sid+".json")
 if not p.exists():
  summary["missing_school_files"]+=1
  schools.append({"school":team["name"],"id":sid,"status":"missing_source_file"})
  continue
 d=json.loads(p.read_text())
 source=d.get("source_url") or ""
 home_arena=registry.get(sid,{}).get("home_arena") or ""
 schools.append({"school":team["name"],"id":sid,"ncaa_id":team.get("id"),
  "school_schedule_file":f"data/mbb-schedules-2026-27/{sid}.json",
  "official_school_schedule_url":source,
  "home_arena":home_arena,"home_arena_source":registry.get(sid,{}).get("home_arena_source") or "",
  "game_count":len(d.get("events",[]))})
 summary["schools"]+=1
 if home_arena:summary["schools_with_home_arena"]+=1
 for event in d.get("events",[]):
  competition=(event.get("competitions") or [{}])[0]
  competitors=competition.get("competitors") or []
  own=next((x for x in competitors if str((x.get("team") or {}).get("id"))==sid),None)
  opponent=next((x for x in competitors if x is not own),None)
  venue=competition.get("venue") or {}
  verified=event.get("site_verified") is True
  if verified:summary["site_verified"]+=1
  else:summary["site_unverified"]+=1
  networks=[]
  for b in competition.get("broadcasts") or event.get("broadcasts") or []:
   if isinstance(b,str):networks.append(b)
   elif isinstance(b,dict):networks.extend(b.get("names") or ([b["name"]] if b.get("name") else []))
  row={
   "school":team["name"],"school_id":sid,"ncaa_id":team.get("id") or "",
   "date":str(event.get("date") or "")[:10],
   "opponent":(opponent or {}).get("team",{}).get("displayName") or event.get("name") or "",
   "opponent_id":(opponent or {}).get("team",{}).get("id") or "",
   "home_away_neutral":(own or {}).get("homeAway") or "unclassified",
   "site_verified":verified,
   "site_review_status":event.get("site_verification_status") or ("verified" if verified else "needs_official_confirmation"),
   "arena":venue.get("arenaName") or "",
   "location":venue.get("official_school_location") or venue.get("fullName") or "",
   "registered_home_arena":home_arena,
   "official_tipoff":event.get("official_school_time") or "",
   "broadcast":"; ".join(str(x) for x in networks),
   "official_school_source":event.get("site_source_url") or event.get("school_source_url") or source,
   "official_game_id":event.get("source_game_id") or ""}
  results.append(row);summary["games"]+=1
  if not row["arena"]:summary["missing_specific_arenas"]+=1
  if not row["broadcast"]:summary["missing_broadcasts"]+=1
assert summary["schools"]==365, f"Expected 365 team files, found {summary['schools']}"
assert summary["games"]==summary["site_verified"]+summary["site_unverified"]
with (data/"mbb-university-master-2026-27.csv").open("w",newline="",encoding="utf-8") as fp:
 writer=csv.DictWriter(fp,fieldnames=columns);writer.writeheader();writer.writerows(results)
manifest={"season":"2026-27","sport":"NCAA Division I men's basketball",
 "source_policy":"Official university athletics website URLs attached to existing school records; unverified fields explicitly flagged",
 "note":"Consolidation of existing school-sourced snapshots, not a fresh re-download or proof that all fields are correct.",
 "generated_at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "summary":dict(summary),"schools":schools,
 "master_csv":"data/mbb-university-master-2026-27.csv",
 "update_command":"python scripts/mbb_build_university_master.py",
 "schema":columns}
(data/"mbb-university-master-2026-27.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(manifest["summary"],indent=2))

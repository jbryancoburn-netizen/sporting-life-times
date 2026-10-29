#!/usr/bin/env python3
"""365-school MBB source/readiness ledger. No inferred facts count as verified."""
import json
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
R=Path(__file__).resolve().parents[1]; D=R/"data"
cross=json.loads((D/"ncaam-2026-27-espn-team-crosswalk.json").read_text())["teams"]
roster_dir=D/"mbb-rosters-2026-27"; schedule_dir=D/"mbb-schedules-2026-27"
rows=[]
for school in cross:
    sid=str(school["espn_id"]); p=schedule_dir/(sid+".json")
    issues=Counter(); games=[]; source=""
    try:
        raw=json.loads(p.read_text())
        games=raw.get("events",[]); source=raw.get("source_url","")
        if not source or not raw.get("verified_from_school"): issues["official_schedule_not_confirmed"]+=1
        if not games: issues["empty_schedule"]+=1
        seen=set()
        for e in games:
            c=(e.get("competitions") or [{}])[0]
            ps=c.get("competitors") or []
            own=next((v for v in ps if str((v.get("team") or {}).get("id"))==sid),None)
            opp=next((v for v in ps if v is not own),None)
            oppteam=(opp or {}).get("team") or {}
            day=str(e.get("date") or "")[:10]
            label=(str(oppteam.get("id") or "") or str(oppteam.get("displayName") or e.get("name") or "")).lower()
            if not day or not label: issues["unidentified_game"]+=1
            key=(day,label)
            if key in seen: issues["duplicate_game"]+=1
            seen.add(key)
            if not e.get("site_verified") or (own or {}).get("homeAway") not in ("home","away","neutral"): issues["site_unverified"]+=1
            if not (c.get("venue") or {}).get("arenaName"): issues["game_arena_unverified"]+=1
            if not (e.get("official_school_time") or e.get("official_time")): issues["tipoff_unverified"]+=1
            if not (c.get("broadcasts") or e.get("broadcasts")): issues["broadcast_not_listed"]+=1
            # Non-DI opponents legitimately lack an ESPN DI crosswalk ID.
            if not oppteam.get("id"): issues["opponent_provider_id_missing"]+=1
    except (OSError, ValueError, TypeError, KeyError) as ex:
        issues["missing_or_invalid_schedule"]+=1
    rp=roster_dir/(sid+".json")
    try:
        roster=json.loads(rp.read_text())
        if roster.get("season")!="2026-27" or len(roster.get("players",[]))<5: issues["roster_unverified"]+=1
    except (OSError, ValueError, TypeError): issues["roster_unverified"]+=1
    blocking={k:v for k,v in issues.items() if k in ("missing_or_invalid_schedule","official_schedule_not_confirmed","empty_schedule","unidentified_game","duplicate_game","site_unverified","roster_unverified")}
    state="needs_research" if blocking or issues else "data_checked"
    # No page is marked 'complete' without an independent published-page check.
    rows.append({"school":school["name"],"ncaa_id":school["id"],"espn_id":sid,
                 "games":len(games),"schedule_source":source,"status":state,
                 "published_page_checked":False,"issues":dict(issues)})
summary=Counter(r["status"] for r in rows)
report={"generated_at":datetime.now(timezone.utc).isoformat(),"season":"2026-27",
        "scope":"File-only certification. No live university or published-page visual verification.",
        "schools_total":len(rows),"status_counts":dict(summary),"schools":rows}
(D/"mbb-school-verification-ledger.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps({"schools":len(rows),"statuses":dict(summary)},indent=2))

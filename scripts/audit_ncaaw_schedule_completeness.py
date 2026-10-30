#!/usr/bin/env python3
"""Audit ALL 2026-27 NCAAW team-game rows before any broadcast work.

Usage: python scripts/audit_ncaaw_schedule_completeness.py
Writes actionable JSON with unmatched official evidence, full per-school coverage,
reciprocity, and quarantined site conflicts; never changes schedules.
"""
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
def read(name):
    return json.loads((DATA/name).read_text(encoding="utf-8"))

def main():
    master=read("ncaaw-schedules-2026-27.json")
    official=read("ncaaw-2026-27-official-schedule-bulk-audit.json")
    teams=master["teams"]
    by_id=defaultdict(list)
    errors=[]
    per_team={}
    for tid,team in teams.items():
        ids=set()
        rows=team["games"]
        for g in rows:
            gid=str(g["id"])
            if gid in ids:
                errors.append({"kind":"duplicate_team_game","team_id":tid,"game_id":gid})
            ids.add(gid)
            by_id[gid].append((tid,g))
        per_team[tid]={"team":team["team"],"schedule_entries":len(rows)}
    for gid, records in by_id.items():
        if len(records)>2:
            errors.append({"kind":"game_has_more_than_two_team_rows","game_id":gid})
        if len(records)==1:
            tid,g=records[0]
            if str(g.get("opponent_id")) in teams:
                errors.append({"kind":"missing_d1_reciprocal","game_id":gid,"team_id":tid})
        if len(records)==2:
            (ta,a),(tb,b)=records
            if str(a.get("opponent_id"))!=tb or str(b.get("opponent_id"))!=ta:
                errors.append({"kind":"opponent_reciprocal_mismatch","game_id":gid})
            for field in ("date","home_id","away_id","venue"):
                if a.get(field)!=b.get(field):
                    errors.append({"kind":"reciprocal_field_disagreement","game_id":gid,"field":field})
    priorities=[]
    for row in official["school_results"]:
        tid=str(row["team_id"])
        o=per_team.get(tid)
        if o is None:
            errors.append({"kind":"official_school_not_in_master","team_id":tid})
            continue
        matches=int(row.get("matched") or 0)
        conflicts=int(row.get("site_conflicts") or 0)
        source_rows=int(row.get("source_rows") or 0)
        o.update({"official_source":row.get("source"),"official_status":row.get("status"),
                  "official_matched_rows":matches,"official_source_rows":source_rows,
                  "unmatched_official_source_rows":max(source_rows-matches,0),
                  "official_site_conflicts":conflicts,
                  "all_master_rows_officially_matched":matches>=o["schedule_entries"]})
        if not o["all_master_rows_officially_matched"] or conflicts:
            priorities.append({"team_id":tid,**o})
    priorities.sort(key=lambda r:(r["official_site_conflicts"]*10+
        r["unmatched_official_source_rows"]+(r["schedule_entries"]-r["official_matched_rows"])),reverse=True)
    unique=len(by_id)
    paired=sum(len(rows)==2 for rows in by_id.values())
    singles=sum(len(rows)==1 for rows in by_id.values())
    result={"season":"2026-27","scope":"women_only_schedule","programs":len(teams),
       "team_game_rows":sum(len(t["games"]) for t in teams.values()),
       "unique_games":unique,"paired_d1_games":paired,"single_non_d1_games":singles,
       "schools_fully_matched_to_official_evidence":sum(x.get("all_master_rows_officially_matched",False) for x in per_team.values()),
       "schools_with_official_coverage_or_site_gaps":len(priorities),
       "official_evidence_limit":"Printed source rows include games outside current master or postseason placeholders; unmatched does not automatically mean missing games.",
       "errors":errors,"priority_schools":priorities,"all_schools":per_team,
       "policy":"Do not use broadcast data until schedules are certified. Never invent a game, tipoff, or venue."}
    out=DATA/"ncaaw-schedule-completeness-deep-audit.json"
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k not in ("priority_schools","all_schools","errors")},indent=2))
    print(f"Integrity errors: {len(errors)}; actionable report: {out}")
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()

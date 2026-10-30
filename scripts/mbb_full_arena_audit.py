#!/usr/bin/env python3
"""Full 2026-27 MBB arena rebuild. Never infer a specific venue from city alone."""
import argparse
import copy
import datetime
import json
import pathlib
import re
from collections import Counter, defaultdict

ROOT = pathlib.Path("data/mbb-schedules-2026-27")
AUDIT = pathlib.Path("data/mbb-arena-unresolved-live-2026-27.json")
LEDGER = pathlib.Path("data/mbb-arena-game-ledger-2026-27.json")
EXCEPTIONS = pathlib.Path("data/mbb-arena-exceptions-2026-27.json")
VALID_PROVENANCE = {"official_host_2026_27_home_schedule", "official_2026_27_host_game_schedule",
 "official_host_school_game_schedule", "official_host_school_game_schedule_2026_27",
 "reciprocal_official_game", "official_venue_game_specific", "official_school_game_specific"}
BAD = {"", "tba", "tbd", "unknown", "n/a", "none", "-"}
def norm(v):
    return re.sub(r"\\s+", " ", str(v or "").strip()).casefold()
def arena(v):
    s = str(v.get("arenaName") or "").strip()
    return s if norm(s) not in BAD else ""
def date(e):
    return str(e.get("date") or "")[:10]
def competitors(e):
    try:
        c = e["competitions"][0]["competitors"]
        return [(str(x["team"]["id"]), x.get("homeAway","")) for x in c]
    except (KeyError, IndexError, TypeError):
        return []
def venue(e):
    try:
        return e["competitions"][0].setdefault("venue", {})
    except (KeyError, IndexError, TypeError):
        return None
def verified(v):
    return bool(arena(v) and (v.get("arena_source_url") or v.get("arenaName_verified_via"))
                and norm(v.get("arena_source_type")) != "official_school_home_arena_default_not_game_specific")
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--write",action="store_true",help="write verified repairs, ledger, and audit")
    args=ap.parse_args()
    files=sorted(ROOT.glob("*.json"))
    assert len(files)==365, f"expected 365 schedule files; found {len(files)}"
    schedules={}
    entries=[]
    for path in files:
        data=json.loads(path.read_text(encoding="utf-8"))
        team=str(data.get("espn_team_id") or path.stem)
        assert path.stem==team, f"team mismatch {path}"
        assert isinstance(data.get("events"),list), f"missing events {path}"
        schedules[path]=data
        for e in data["events"]:
            v=venue(e)
            if v is None: continue
            pair=competitors(e)
            ids=sorted(set(t for t,_ in pair))
            d=date(e)
            # Records missing an opponent are not combined speculatively.
            key=d+":"+ "|".join(ids) if d and len(ids)==2 else team+":"+str(e.get("id") or d)
            entries.append(dict(key=key,date=d,team=team,path=path,event=e,venue=v,
                                ids=ids,teams=pair))
    groups=defaultdict(list)
    for r in entries: groups[r["key"]].append(r)
    fixes=[]
    conflicts=[]
    for key, rows in groups.items():
        # Non-two-team groups are quarantined; avoid matching by date alone.
        if len(rows[0]["ids"])!=2: continue
        # A valid reciprocal game normally appears once on each team's file.
        # Reject repeated entries and conflicting site classifications.
        owners=[r["team"] for r in rows]
        if len(set(owners))!=len(owners):
            conflicts.append(dict(key=key,reason="duplicate owner records",files=owners))
            continue
        homes={next((t for t,ha in r["teams"] if ha=="home"),None) for r in rows}
        neutral=any(r["event"].get("neutralSite") or any(ha=="neutral" for _,ha in r["teams"]) for r in rows)
        if neutral or len(homes)>1:
            if len(homes)>1: conflicts.append(dict(key=key,reason="home-away mismatch",files=owners))
            continue
        known={norm(arena(r["venue"])):r for r in rows if verified(r["venue"])}
        if len(known)>1:
            conflicts.append(dict(key=key,reason="conflicting sourced arena names",
                                  arenas=[arena(x["venue"]) for x in known.values()]))
            continue
        if not known: continue
        source=next(iter(known.values()))
        for r in rows:
            if arena(r["venue"]): continue
            if r["team"] not in r["ids"]: continue
            r["venue"]["arenaName"]=arena(source["venue"])
            r["venue"]["arena_source_url"]=source["venue"].get("arena_source_url") or source["event"].get("school_source_url","")
            r["venue"]["arena_source_type"]="reciprocal_official_game"
            r["venue"]["arenaName_verified_via"]="exact_date_two_team_match"
            fixes.append(dict(key=key,team=r["team"],arena=arena(source["venue"]),source_team=source["team"]))
    remaining=[r for r in entries if not arena(r["venue"])]
    unresolved=defaultdict(list)
    for r in remaining: unresolved[r["key"]].append(r)
    schools=sorted((dict(school_id=str(s.get("espn_team_id") or path.stem),
                          school=s.get("source_name","Official university athletics schedule"),
                          game_count=len(s["events"]),
                          missing_arena_fields=sum(1 for r in remaining if r["path"]==path))
                    for path,s in schedules.items()),key=lambda x:x["school_id"])
    def public(r):
        return dict(school_id=r["team"],event_id=r["event"].get("id"),date=r["date"],
                    opponent_ids=r["ids"],game=r["event"].get("name",""),
                    home_away=next((ha for t,ha in r["teams"] if t==r["team"]),""),
                    location=r["venue"].get("fullName",""),
                    source_url=r["event"].get("school_source_url",""))
    records=[public(r) for r in remaining]
    unique=[dict(key=k,date=rs[0]["date"],opponent_ids=rs[0]["ids"],
                 school_ids=sorted({r["team"] for r in rs}),missing_record_count=len(rs),
                 events=[public(r) for r in rs]) for k,rs in sorted(unresolved.items())]
    summary=dict(schools_scanned=len(files),total_game_records=sum(len(s["events"]) for s in schedules.values()),
                 missing_arena_fields=len(records),schools_with_missing_arenas=sum(s["missing_arena_fields"]>0 for s in schools),
                 unique_unresolved_groups=len(unique),grouped_duplicate_records=len(records)-len(unique),
                 paired_missing_records=sum(len(g["events"]) for g in unique if len(g["events"])>1),
                 groups_with_unidentified_opponents=sum(len(g["opponent_ids"])<2 for g in unique),
                 verified_reciprocal_arena_repairs=len(fixes),conflicting_games=len(conflicts))
    audit=dict(title="Independent 365-schedule MBB arena audit",school_count_total=365,
               schools_scanned=365,scan_status="full_365_file_rescan",
               match_method="same date + exactly two known team IDs; incomplete IDs remain separate",
               generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               schools=schools,records=records,summary=summary,unique_games=unique)
    ledger=[dict(key=k,date=rs[0]["date"],competitor_ids=rs[0]["ids"],
                 records=[dict(team=r["team"],event_id=r["event"].get("id"),
                               arena=arena(r["venue"]),source_url=r["venue"].get("arena_source_url",""),
                               home_away=next((h for t,h in r["teams"] if t==r["team"]),"")) for r in rs])
            for k,rs in sorted(groups.items())]
    def put(p,v):
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+"\\n",encoding="utf-8")
    if args.write:
        for path,data in schedules.items():
            if any(f["team"]==str(data.get("espn_team_id") or path.stem) for f in fixes):
                put(path,data)
        put(AUDIT,audit)
        put(LEDGER,dict(summary=summary,games=ledger))
        put(EXCEPTIONS,dict(conflicts=conflicts,unresolved_groups=unique))
    print(json.dumps(summary,indent=2))
    if not args.write: print("DRY RUN: use --write to publish locally")
if __name__=="__main__": main()

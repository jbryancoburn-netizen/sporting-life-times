#!/usr/bin/env python3
"""Reproduce four official-source corroborated 2026-27 transfers from 2025-26 NCAA box.

Previous university biographies show 2025-26 D-I school; uniquely matching
a name within that school's ORIGINAL NCAA-origin per-game records yields the
historical NCAA player ID and statistics. This does NOT create an official
ESPN-to-NCAA person-ID bridge, nor does it change primary preseason Elo.
"""
import argparse
import csv
import gzip
import hashlib
import json
import math
import unicodedata
from collections import defaultdict
from pathlib import Path

def key(name):
    return "".join(c for c in unicodedata.normalize("NFKD",str(name).casefold())
                   if c.isalnum() and not unicodedata.combining(c))
def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))
def evaluate(parquet,csv_gz,origin,movement,crosswalk):
    payload=Path(parquet).read_bytes()
    digest=hashlib.sha256(payload).hexdigest()
    if digest!=origin["canonical_ncaam_player_box_2026_parquet_sha256"]:
        raise ValueError("Historical original NCAA box source hash changed")
    if origin.get("automatic_elo_linking_authorized") is not False or origin.get("production_elo_approved") is not False:
        raise ValueError("Uncertified prior-school match must never auto-promote")
    people={}
    for school in movement["teams"]:
        for person in school["players"]:
            if str(person["current_id"]) in people:
                raise ValueError("Repeated 2026-27 ESPN roster ID")
            people[str(person["current_id"])]=(school["team"],person)
    forbidden={str(p["id"]) for p in crosswalk["links"]}
    buckets=defaultdict(list)
    expected={(key(x["player"]),x["prior_school_id"][5:]) for x in origin["records"]}
    with gzip.open(csv_gz,"rt",encoding="utf-8",newline="") as f:
        for row in csv.DictReader(f):
            if (key(row.get("player")) ,str(row.get("team_ncaa_team_id",""))) in expected:
                buckets[(key(row["player"]),str(row["team_ncaa_team_id"]))].append(row)
    proven=[]
    seen_espn=set()
    seen_ncaa=set()
    for r in origin["records"]:
        espn=str(r["current_espn_id"])
        school,person=people.get(espn,(None,None))
        if espn in seen_espn or espn in forbidden:
            raise ValueError("Already linked or repeated current athlete "+espn)
        seen_espn.add(espn)
        if (school!=r["school"] or person["player"]!=r["player"] or
            person.get("prior_school_id")!=r["prior_school_id"] or
            person["status"]!="unique-name-transfer-candidate"):
            raise ValueError("Current 2026-27 roster differs from official transfer prior-school attestation")
        rows=buckets.get((key(r["player"]),r["prior_school_id"][5:]),[])
        historical_ids={x["player_id"] for x in rows}
        if len(historical_ids)!=1 or not rows:
            raise ValueError("Historical 2025-26 NCAA player is not unique for "+r["player"])
        ncaa_id=next(iter(historical_ids))
        if ncaa_id in seen_ncaa:raise ValueError("NCAA person ID accidentally reused for separate current athlete")
        seen_ncaa.add(ncaa_id)
        minutes=sum(float(x["mins"] or 0) for x in rows)
        points=sum(float(x["pts"] or 0) for x in rows)
        if (ncaa_id!=r["historical_ncaa_athlete_id"] or
            len(rows)!=r["historical_2025_26_games_with_positive_minutes"] or
            abs(minutes-r["historical_2025_26_minutes"])>0.025 or
            abs(points-r["historical_2025_26_points"])>0.01 or
            abs(minutes-person["prior_minutes"])>0.04 or
            abs(points-person["prior_points"])>0.01):
            raise ValueError("Pinned original NCAA team-player ID or historical box score does not reproduce for "+r["player"])
        proven.append({
            "current_espn_id":espn,"current_school":school,"player":r["player"],
            "historical_2025_26_ncaa_athlete_id":ncaa_id,
            "historical_school_id":r["prior_school_id"],
            "2025_26_games":len(rows),
            "prior_minutes":round(minutes,3),"prior_points":int(points),
            "school_official_source":r["source_url"],
            "unique_ncaa_name_and_prior_school":True,
            "independent_ESPN_to_NCAA_person_ID_bridge":False,
            "eligible_for_automatic_official_elo":False})
    if len(proven)!=4:
        raise ValueError("Four official corroborated transfers not all reproduced")
    return {
        "season":"2026-27",
        "status":"four_2025_26_original_ncaa_player_ids_reproduced_shadow_only",
        "production_elo_approved":False,
        "2026_27_current_espn_ids_not_in_pinned_crosswalk":True,
        "old_ncaa_player_ids_uniquely_identified_by_name_and_prior_school":True,
        "independent_espn_ncaa_id_bridge_verified":False,
        "canonical_original_2025_26_ncaa_box_parquet_sha256":digest,
        "added_current_roster_athletes":4,
        "games_in_source_sample":sum(x["2025_26_games"] for x in proven),
        "source_player_minute_total":round(sum(x["prior_minutes"] for x in proven),3),
        "source_player_point_total":sum(x["prior_points"] for x in proven),
        "candidate_athlete_source_links":sorted(proven,key=lambda x:x["current_school"])}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--parquet",required=True)
    ap.add_argument("--csv",required=True)
    ap.add_argument("--root",type=Path,default=Path("data"))
    ap.add_argument("--out",type=Path,default=Path("data/ncaam-2026-27-four-player-source-replay.json"))
    ap.add_argument("--verify",action="store_true")
    args=ap.parse_args()
    d=args.root
    result=evaluate(args.parquet,args.csv,
           load(d/"ncaam-2026-27-official-prior-school-corroborations.json"),
           load(d/"ncaam-2026-27-player-movement-audit.json"),
           load(d/"ncaam-2026-27-direct-player-crosswalk.json"))
    rendered=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
    if args.verify:
        if not args.out.exists() or args.out.read_text(encoding="utf-8")!=rendered:
            raise SystemExit("FAIL: four additional D-I athlete source IDs no longer reproduce")
        print("PASS: 4 official-school corroborated historic NCAA player IDs; primary Elo not promoted")
    else:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(rendered,encoding="utf-8")
        print(json.dumps({k:result[k] for k in ("status","added_current_roster_athletes","games_in_source_sample","source_player_minute_total")},indent=2))
if __name__=="__main__":main()

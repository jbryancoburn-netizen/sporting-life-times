#!/usr/bin/env python3
"""Source-first academic-year classification for the 2,014 NCAA unlinked players.

Accept only individually attributed OFFICIAL school records; ESPN is never
used to infer class year. Supports externally collected official roster rows
without treating roster absence or missing past stats as freshman evidence.
"""
import argparse,csv,json,re
from collections import Counter
from pathlib import Path

YEARS={"fr":"freshman","freshman":"freshman","first year":"freshman",
"r-fr":"redshirt_freshman","rs fr":"redshirt_freshman","redshirt freshman":"redshirt_freshman",
"so":"sophomore","sophomore":"sophomore","r-so":"redshirt_sophomore",
"redshirt sophomore":"redshirt_sophomore","jr":"junior","junior":"junior",
"r-jr":"redshirt_junior","redshirt junior":"redshirt_junior",
"sr":"senior","senior":"senior","r-sr":"redshirt_senior",
"redshirt senior":"redshirt_senior","gr":"graduate","grad":"graduate",
"graduate":"graduate","fifth year":"graduate"}
def normalized(v):return re.sub(r"[^a-z0-9]","",str(v).casefold())
def classify(movement,crosswalk,rows):
    roster={}
    for t in movement["teams"]:
        for p in t["players"]:
            ident=str(p["current_id"])
            if ident in roster:raise ValueError("Duplicate current athlete")
            roster[ident]=(t,p)
    wanted={str(x) for x in crosswalk["unlinked_espn_ids"]}
    if len(wanted)!=2014:raise ValueError("Unlinked source changed")
    accepted={};rejected=[]
    for i,record in enumerate(rows,1):
        athlete=str(record.get("current_athlete_id","")).strip()
        url=str(record.get("official_roster_url","")).strip()
        label=" ".join(str(record.get("class_year","")).casefold().replace("."," ").replace("-"," ").split())
        label=label.replace("rs ", "redshirt ").replace("r ", "redshirt ")
        year=YEARS.get(label)
        if athlete not in wanted or athlete in accepted:
            rejected.append({"row":i,"reason":"unknown_or_duplicate_current_athlete"});continue
        t,p=roster[athlete]
        if normalized(record.get("player"))!=normalized(p["player"]) or normalized(record.get("team"))!=normalized(t["team"]):
            rejected.append({"row":i,"reason":"athlete_name_or_team_mismatch"});continue
        if not url.startswith("https://") or not re.search(r"/(sports|roster|athletics)/",url):
            rejected.append({"row":i,"reason":"not_an_official_roster_url"});continue
        if not year:
            rejected.append({"row":i,"reason":"unrecognized_academic_year"});continue
        accepted[athlete]={"athlete_id":athlete,"player":p["player"],"team":t["team"],"team_id":t["team_id"],
          "academic_year":year,"official_roster_url":url,
          "evidence_kind":"attributed_official_school_roster_record",
          "historical_ncaabox_id_verified":False,"automatic_stat_join_authorized":False}
    counts=dict(Counter(p["academic_year"] for p in accepted.values()))
    return {"season":"2026-27","population":"2,014 previously unlinked current players",
      "source_policy":"Official school athletics roster evidence exclusively; no ESPN-based freshman inference",
      "players_targeted":2014,"official_class_year_records":len(accepted),
      "still_missing_official_class_year":2014-len(accepted),
      "counts":counts,"rejected_input_rows":rejected,
      "players":sorted(accepted.values(),key=lambda x:(x["team"],x["player"])),
      "publication_elo_changed":False,
      "note":"Counts are source-attributed classifications, not a claimed exhaustive count of freshmen."}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--movement",default="data/ncaam-2026-27-player-movement-audit.json")
    ap.add_argument("--crosswalk",default="data/ncaam-2026-27-direct-player-crosswalk.json")
    ap.add_argument("--official-rows",default="data/ncaam-2026-27-school-roster-class-years.csv")
    ap.add_argument("--out",default="data/ncaam-2026-27-unlinked-official-class-years.json")
    args=ap.parse_args()
    with open(args.official_rows,newline="",encoding="utf-8") as f: rows=list(csv.DictReader(f))
    report=classify(json.loads(Path(args.movement).read_text()),json.loads(Path(args.crosswalk).read_text()),rows)
    Path(args.out).write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:report[k] for k in ("players_targeted","official_class_year_records","still_missing_official_class_year","counts","rejected_input_rows")},indent=2))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""Publish only factual NCAA 2020-2026 acquisition and ID-mapping readiness."""
import csv,json,hashlib
from pathlib import Path
base=Path("historical-normalized/ncaa")
years=[]
for y in range(2020,2027):
 path=base/f"ncaa-{y}-finals.csv";audit=base/f"ncaa-{y}-audit.json"
 row={"season":y,"present":path.exists() and audit.exists(),"games":0,"complete_retrieval":False,"elo_import_ready":False}
 if row["present"]:
  d=json.loads(audit.read_text())
  with path.open(newline="") as f: n=sum(1 for _ in csv.DictReader(f))
  if d.get("games")!=n:raise ValueError(f"{y} CSV and audit disagree")
  row.update({"games":n,"complete_retrieval":n>=1000 and not d.get("failed_dates"),
              "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
              "unmatched_team_ids":True})
 years.append(row)
out={"status":"EVIDENCE_ONLY_NOT_YET_JOINED_TO_1985_2019_IDS","years":years,
     "years_downloaded":sum(x["present"] for x in years),
     "years_retrieval_complete":sum(x["complete_retrieval"] for x in years),
     "historical_elo_extended":False,
     "reason":"Unmapped NCAA.com school names cannot be silently converted to Kaggle historical team IDs"}
dest=Path("data/ncaam-2020-2026-import-readiness.json");dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps({"downloaded":out["years_downloaded"],"complete":out["years_retrieval_complete"]}))

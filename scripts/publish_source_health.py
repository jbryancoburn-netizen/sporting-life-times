#!/usr/bin/env python3
"""Publish operational provenance, not guessed health or successful status."""
import json
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(name):
 try:return json.loads((ROOT/name).read_text(encoding="utf-8"))
 except (OSError,ValueError):return {}
def main():
 now=datetime.now(timezone.utc)
 records=[]
 for file in ("scoreboards.json","official_scoreboards.json","multi_scoreboards.json"):
  data=load(file)
  for block in data.get("leagues",[]):
   records.append({"file":file,"league":block.get("league"),"provider":block.get("provider") or data.get("source"),"games":len(block.get("games") or []),"error":block.get("error"),"warnings":block.get("warnings",[]),"updated_at":data.get("updated_at")})
 college=load("college_schedules.json")
 for item in college.get("teams",[]):
  records.append({"file":"college_schedules.json","league":item.get("team"),"provider":item.get("provider"),"games":len(item.get("games") or []),"error":item.get("error"),"warnings":[item["warning"]] if item.get("warning") else [],"updated_at":college.get("updated_at")})
 report={"generated_at":now.isoformat(),"providers":records,"quarantined_conflicts":load("multi_scoreboards.json").get("conflicts",[]),"statcast":load("statcast_health.json")}
 (ROOT/"data/source-health.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print("Provider health:",len(records),"records; quarantined conflicts:",len(report["quarantined_conflicts"]))
if __name__=="__main__":main()

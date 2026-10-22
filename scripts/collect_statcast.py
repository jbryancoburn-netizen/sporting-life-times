#!/usr/bin/env python3
"""Bounded Statcast availability check; no bulk data republishing."""
import csv,io,json
from datetime import datetime,timezone,timedelta
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
def main():
 day=(datetime.now(timezone.utc)-timedelta(days=2)).date().isoformat()
 url="https://baseballsavant.mlb.com/statcast_search/csv?type=pitcher&game_date_gt="+day+"&game_date_lt="+day+"&player_type=pitcher"
 result={"checked_at":datetime.now(timezone.utc).isoformat(),"provider":"baseball_savant","date":day,"status":"unavailable","sample_columns":[],"rights_cleared":False}
 try:
  req=Request(url,headers={"User-Agent":"SportingLifeTimes/1.0","Accept":"text/csv"})
  with urlopen(req,timeout=12) as response:body=response.read(16384).decode("utf-8-sig","replace")
  reader=csv.DictReader(io.StringIO(body));result["sample_columns"]=list(reader.fieldnames or [])[:45]
  result["status"]="reachable" if "launch_speed" in result["sample_columns"] else "unexpected_schema"
 except Exception as exc:result["error"]=type(exc).__name__+": "+str(exc)[:150]
 (ROOT/"statcast_health.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
 print("Statcast:",result["status"])
if __name__=="__main__":main()

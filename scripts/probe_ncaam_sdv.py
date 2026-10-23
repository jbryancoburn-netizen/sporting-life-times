#!/usr/bin/env python3
"""Probe NCAA-origin SportsDataverse season archive and preserve exact schema."""
import argparse,csv,gzip,hashlib,json
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://github.com/sportsdataverse/sportsdataverse-data/releases/download/ncaa_mbb_schedule/ncaa_mbb_schedule_{season}.csv.gz"
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--season",type=int,default=2026)
 p.add_argument("--output",type=Path,default=Path("staging/ncaam-sdv-probe"))
 a=p.parse_args()
 if not 2010<=a.season<=2027:p.error("Unexpected year")
 url=BASE.format(season=a.season)
 request=Request(url,headers={"User-Agent":"SportingLifeTimes/1.0"})
 with urlopen(request,timeout=60) as resp:data=resp.read(15000000)
 if len(data)<100:raise ValueError("Season archive appears empty")
 raw=gzip.decompress(data).decode("utf-8-sig")
 rows=list(csv.DictReader(raw.splitlines()))
 if not rows:raise ValueError("No parsed schedule rows")
 keys=list(rows[0])
 stats={key:{"nonempty":sum(bool(str(row.get(key) or "").strip()) for row in rows),
              "samples":list(dict.fromkeys(str(row.get(key) or "") for row in rows if str(row.get(key) or "").strip()))[:4]} for key in keys}
 result={"status":"schema-only; not approved Elo games","season":a.season,"source_url":url,
         "upstream_origin":"stats.ncaa.org via SportsDataverse",
         "retrieved_at":datetime.now(timezone.utc).isoformat(),
         "sha256_gzip":hashlib.sha256(data).hexdigest(),
         "rows":len(rows),"columns":keys,"field_diagnostics":stats}
 a.output.mkdir(parents=True,exist_ok=True)
 (a.output/"schema-report.json").write_text(json.dumps(result,indent=2)+"\n")
 (a.output/"season.csv.gz").write_bytes(data)
 ids_url=f"https://github.com/sportsdataverse/sportsdataverse-data/releases/download/ncaa_mbb_team_ids/ncaa_mbb_team_ids_{a.season}.csv.gz"
 with urlopen(Request(ids_url,headers={"User-Agent":"SportingLifeTimes/1.0"}),timeout=60) as response:
  team_bytes=response.read(2000000)
 id_rows=list(csv.DictReader(gzip.decompress(team_bytes).decode("utf-8-sig").splitlines()))
 if not id_rows:raise ValueError("NCAA team ID asset empty")
 (a.output/"team-ids.csv.gz").write_bytes(team_bytes)
 result["teams_source_url"]=ids_url
 result["team_ids_count"]=len(id_rows)
 result["team_ids_columns"]=list(id_rows[0])
 result["team_ids_sample"]=id_rows[:3]
 (a.output/"schema-report.json").write_text(json.dumps(result,indent=2)+"\\n")
 print(json.dumps({"team_ids_count":len(id_rows),"team_ids_columns":list(id_rows[0]),"team_ids_sample":id_rows[:3]},indent=2))
 print(json.dumps({"rows":len(rows),"columns":keys,"sample_rows":rows[:3],"sha256":result["sha256_gzip"]},indent=2))
if __name__=="__main__":main()

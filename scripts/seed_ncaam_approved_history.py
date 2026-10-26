#!/usr/bin/env python3
"""Prepare permitted CC0 UNC/Duke schedule evidence for licensed multi-source reconciliation.
Sources: joongsup/uncmbb licensed CC0 (inspect upstream DESCRIPTION).
This is a partial source seed, not a nationally complete archive.
"""
import csv,hashlib,json,argparse
from pathlib import Path
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--input",type=Path,default=Path("historical-normalized/unc-duke-historical-fixtures.csv"))
 ap.add_argument("--output-csv",type=Path,default=Path("historical-normalized/pre1985-approved/unc-duke-cc0.csv"))
 ap.add_argument("--output-manifest",type=Path,default=Path("historical-report/ncaam-approved-source-manifest.json"))
 a=ap.parse_args()
 a.output_csv.parent.mkdir(parents=True,exist_ok=True);a.output_manifest.parent.mkdir(parents=True,exist_ok=True)
 records=[]
 with a.input.open(newline="",encoding="utf-8-sig") as f:
  for r in csv.DictReader(f):
   try:
    year=int(r["Season"])
    if year<1950 or year>1984:continue
    row={"season":year,"date":r["Game_Date"],"homeTeam":r["Source_Team"],
         "awayTeam":r["Opponent_School"],"homePoints":int(r["Tm"]),"awayPoints":int(r["Opp"])}
    records.append(row)
   except (ValueError,TypeError,KeyError):continue
 if len(records)<1800:raise ValueError("Historical CC0 seed unexpectedly incomplete")
 with a.output_csv.open("w",newline="",encoding="utf-8") as f:
  writer=csv.DictWriter(f,fieldnames=("season","date","homeTeam","awayTeam","homePoints","awayPoints"))
  writer.writeheader();writer.writerows(records)
 raw=a.output_csv.read_bytes()
 manifest={"sources":[{"name":"uncmbb-CC0-UNC-and-Duke","path":str(a.output_csv),
    "source_url":"https://github.com/joongsup/uncmbb",
    "license_or_permission":"CC0 1.0 per upstream DESCRIPTION (UNC/Duke historical match datasets)",
    "reuse_authorized":True,"sha256":hashlib.sha256(raw).hexdigest()}],
    "scope":"Verified raw UNC/Duke schedules only; NOT complete national results",
    "require_additional_sources":True}
 a.output_manifest.write_text(json.dumps(manifest,indent=2)+"\n")
 print(json.dumps({"raw_source_rows":len(records),"sha256":manifest["sources"][0]["sha256"]}))
if __name__=="__main__":main()
